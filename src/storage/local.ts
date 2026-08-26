import type { StudyRecord } from '../types';

export const LEGACY_STORAGE_PREFIX = 'study-v10.4:';
export const GUEST_STORAGE_PREFIX = 'study-v11:guest:';
export const USER_STORAGE_PREFIX = 'study-v11:user:';

export interface StorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export function storagePrefixForUser(userId: string | null | undefined): string {
  return userId ? `${USER_STORAGE_PREFIX}${userId}:` : GUEST_STORAGE_PREFIX;
}

export function recordStorageKey(prefix: string, date: string): string {
  return `${prefix}${date}`;
}

export function listStoredDates(storage: StorageLike, prefix: string): string[] {
  const dates: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const date = key.slice(prefix.length);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.push(date);
  }
  return dates.sort();
}

export function readStoredStudyRecord(
  storage: StorageLike,
  prefix: string,
  date: string,
): StudyRecord | null {
  const raw = storage.getItem(recordStorageKey(prefix, date));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudyRecord;
  } catch {
    return null;
  }
}

export function writeStoredStudyRecord(
  storage: StorageLike,
  prefix: string,
  record: StudyRecord,
): void {
  storage.setItem(recordStorageKey(prefix, record.date), JSON.stringify(record));
}

export class LocalStudyStorage {
  readonly prefix: string;

  constructor(
    private readonly storage: StorageLike = localStorage,
    userId: string | null = null,
  ) {
    this.prefix = storagePrefixForUser(userId);
  }

  load(date: string): StudyRecord | null {
    return readStoredStudyRecord(this.storage, this.prefix, date);
  }

  save(record: StudyRecord): void {
    writeStoredStudyRecord(this.storage, this.prefix, record);
  }

  remove(date: string): void {
    this.storage.removeItem(recordStorageKey(this.prefix, date));
  }

  listDates(): string[] {
    return listStoredDates(this.storage, this.prefix);
  }
}
