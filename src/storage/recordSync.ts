import type { StudyRecord } from '../types';

export interface CloudStudyRecordRow {
  study_date: string;
  payload: StudyRecord | Record<string, unknown>;
  revision: number;
  updated_at: string;
}

export type RevisionSyncDecision =
  | 'use-cloud'
  | 'push-local'
  | 'equal'
  | 'conflict';

const SYNC_META_KEYS = new Set([
  'updatedAt',
  'serverRevision',
  'serverUpdatedAt',
  'localDirty',
  'syncConflict',
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort()) {
    if (SYNC_META_KEYS.has(key)) continue;
    output[key] = canonicalize(input[key]);
  }
  return output;
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function isBlankValue(value: unknown): boolean {
  return value === undefined
    || (typeof value === 'string' && value.trim() === '');
}

function arrayEntryKey(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  const directKeys = ['id', 'deferredOriginId', 'calendarEventId', 'eventId', 'presetKey', 'key'];
  for (const key of directKeys) {
    const candidate = String(entry[key] ?? '').trim();
    if (candidate) return `${key}:${candidate}`;
  }

  const semanticParts = ['type', 'title', 'subject', 'material', 'source', 'name', 'unit', 'word']
    .map((key) => String(entry[key] ?? '').trim());
  return semanticParts.some(Boolean) ? `semantic:${semanticParts.join('|')}` : null;
}

function stableValueKey(value: unknown): string {
  return JSON.stringify(canonicalize(value)) ?? String(value);
}

function mergeArrays(primary: unknown[], secondary: unknown[]): unknown[] {
  const merged = primary.map(cloneValue);
  const keyedIndexes = new Map<string, number>();
  const valueIndexes = new Map<string, number>();

  merged.forEach((entry, index) => {
    const key = arrayEntryKey(entry);
    if (key) keyedIndexes.set(key, index);
    else valueIndexes.set(stableValueKey(entry), index);
  });

  for (const entry of secondary) {
    const key = arrayEntryKey(entry);
    const existingIndex = key ? keyedIndexes.get(key) : valueIndexes.get(stableValueKey(entry));
    if (existingIndex !== undefined) {
      merged[existingIndex] = mergeRecordedValue(merged[existingIndex], entry);
      continue;
    }
    const nextIndex = merged.push(cloneValue(entry)) - 1;
    if (key) keyedIndexes.set(key, nextIndex);
    else valueIndexes.set(stableValueKey(entry), nextIndex);
  }
  return merged;
}

function mergeRecordedValue(primary: unknown, secondary: unknown): unknown {
  if (isBlankValue(primary)) return cloneValue(secondary);
  if (isBlankValue(secondary)) return cloneValue(primary);

  if (Array.isArray(primary) && Array.isArray(secondary)) {
    return mergeArrays(primary, secondary);
  }
  if (
    primary && secondary
    && typeof primary === 'object'
    && typeof secondary === 'object'
    && !Array.isArray(primary)
    && !Array.isArray(secondary)
  ) {
    const left = primary as Record<string, unknown>;
    const right = secondary as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(right), ...Object.keys(left)])) {
      output[key] = mergeRecordedValue(left[key], right[key]);
    }
    return output;
  }

  // When both tabs have a real value for the same scalar field, the tab whose
  // save is currently being processed wins. Empty values never erase data.
  return cloneValue(primary);
}

/**
 * Non-destructively combines a tab's pending record with another stored/cloud
 * copy. Items and nested child entries are unioned by stable identity, while a
 * blank value on either side can never replace a recorded value.
 */
export function mergeStudyRecordsForUpload(
  pending: StudyRecord,
  existing: StudyRecord | null | undefined,
): StudyRecord {
  if (!existing) return cloneValue(pending);
  if (pending.date !== existing.date) {
    throw new Error('Cannot merge study records from different dates.');
  }

  const merged = mergeRecordedValue(pending, existing) as StudyRecord;
  merged.date = pending.date;
  merged.schemaVersion = Math.max(Number(pending.schemaVersion || 0), Number(existing.schemaVersion || 0));
  merged.items = Array.isArray(merged.items) ? merged.items : [];
  return merged;
}

/**
 * Payload sent to Supabase. Device-local sync metadata never enters the
 * authoritative study_records.payload JSON.
 */
export function stripRecordSyncMeta(record: StudyRecord): StudyRecord {
  const copy = JSON.parse(JSON.stringify(record)) as StudyRecord;
  for (const key of SYNC_META_KEYS) delete (copy as unknown as Record<string, unknown>)[key];
  return copy;
}

export function sameStudyContent(
  a: StudyRecord | null | undefined,
  b: StudyRecord | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

/**
 * Pure revision-based decision. Wall-clock timestamps are intentionally not
 * part of conflict resolution.
 */
export function decideRevisionSync(
  local: StudyRecord | null,
  cloud: StudyRecord | null,
): RevisionSyncDecision {
  if (!local && cloud) return 'use-cloud';
  if (local && !cloud) return 'push-local';
  if (!local && !cloud) return 'equal';
  if (sameStudyContent(local, cloud)) return 'equal';

  if (!local || !cloud) return 'conflict';

  const localRevision = Number(local.serverRevision ?? 0);
  const cloudRevision = Number(cloud.serverRevision ?? 0);

  if (local.syncConflict) return 'conflict';

  if (local.localDirty) {
    // A dirty record may be uploaded only if it was edited from the exact
    // server revision that is still current.
    return localRevision === cloudRevision ? 'push-local' : 'conflict';
  }

  // A clean local cache is replaceable by a newer authoritative server row.
  if (localRevision > 0 && cloudRevision > localRevision) return 'use-cloud';

  // Same revision with different contents, unknown legacy revision, or a local
  // revision ahead of the server cannot be ordered safely.
  return 'conflict';
}
