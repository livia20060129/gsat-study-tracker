import type { StudyRecord } from '../types';

export type PullDecision =
  | 'use-cloud'
  | 'keep-local'
  | 'push-local'
  | 'equal'
  | 'conflict';

const SYNC_ONLY_KEYS = new Set([
  'updatedAt',
  'serverUpdatedAt',
  'serverRevision',
  'localDirty',
  'syncConflict',
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort()) {
    if (SYNC_ONLY_KEYS.has(key)) continue;
    output[key] = canonicalize(input[key]);
  }
  return output;
}

export function sameStudyPayload(
  a: StudyRecord | null | undefined,
  b: StudyRecord | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

export function payloadForCloud(record: StudyRecord): Record<string, unknown> {
  return canonicalize(record) as Record<string, unknown>;
}

export function withServerMetadata(
  payload: StudyRecord,
  revision: number,
  updatedAt?: string | null,
): StudyRecord {
  return {
    ...payload,
    serverRevision: revision,
    serverUpdatedAt: updatedAt ?? undefined,
    localDirty: false,
    syncConflict: false,
  };
}

/**
 * Pure pull decision based on server-issued revision numbers.
 * Device clocks are deliberately ignored.
 */
export function decidePull(
  local: StudyRecord | null,
  cloud: StudyRecord | null,
): PullDecision {
  if (!local && cloud) return 'use-cloud';
  if (local && !cloud) return 'push-local';
  if (!local && !cloud) return 'equal';
  if (sameStudyPayload(local, cloud)) return 'equal';

  const localRevision = Number(local?.serverRevision);
  const cloudRevision = Number(cloud?.serverRevision);
  const hasLocalRevision = Number.isInteger(localRevision) && localRevision > 0;
  const hasCloudRevision = Number.isInteger(cloudRevision) && cloudRevision > 0;

  // Scoped records created by the current user may legitimately have no server
  // revision yet. If the server has no record they are safe to insert; if both
  // sides exist and differ, an unversioned local record is ambiguous.
  if (!hasLocalRevision && hasCloudRevision) return 'conflict';
  if (hasLocalRevision && !hasCloudRevision) return 'push-local';

  if (local?.localDirty) {
    if (localRevision === cloudRevision) return 'push-local';
    return 'conflict';
  }

  if (cloudRevision > localRevision) return 'use-cloud';
  if (cloudRevision === localRevision) return 'conflict';

  // A local server revision greater than the server's current revision should
  // never happen in a healthy server-controlled system; do not guess.
  return 'conflict';
}
