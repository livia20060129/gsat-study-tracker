import { decodeStudyRecord, encodeCompressedLocalStudyRecord } from '../../storage/studyRecordCodec.ts';
import type { KeyValueStorage } from './localStudyRecordRepository.ts';
import { invalidateLocalRecordHistory } from './localRecordHistory.ts';
import { compressLocalRecord, isCompressedLocalRecord } from '../../storage/localRecordCompression.ts';

export function isStorageQuotaError(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false;
  const error = cause as { name?: string; code?: number };
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error.code === 22 || error.code === 1014;
}

/** Preserve every day and sync ancestor; replace only verified, smaller lossless representations. */
export function compactConfirmedRecordStorage(storage: KeyValueStorage): number {
  let compacted = 0;
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key) continue;
    const recordKey = /^study-v11:(?:guest|user:[^:]+):\d{4}-\d{2}-\d{2}$/.test(key);
    const receiptKey = /^study-v11:meta:guest-import:\d{4}-\d{2}-\d{2}$/.test(key);
    if (!recordKey && !receiptKey) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw || isCompressedLocalRecord(raw)) continue;
      let compact: string;
      if (recordKey) {
        const decoded = decodeStudyRecord(raw, key.slice(-10));
        if (!decoded.ok) continue;
        compact = encodeCompressedLocalStudyRecord(decoded.record);
      } else {
        const receipt = JSON.parse(raw);
        if (!receipt || typeof receipt.owner !== 'string' || !receipt.itemIds || typeof receipt.itemIds !== 'object') continue;
        compact = compressLocalRecord(JSON.stringify(receipt));
      }
      if (compact.length >= raw.length) continue;
      storage.setItem(key, compact);
      invalidateLocalRecordHistory(storage, key);
      compacted += 1;
    } catch { /* One unreadable key must not prevent safe compaction of other records. */ }
  }
  return compacted;
}
