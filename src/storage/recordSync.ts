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
