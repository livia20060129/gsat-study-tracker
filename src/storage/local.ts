import type { StudyRecord } from '../types';

export const LEGACY_UNSCOPED_PREFIX = 'study-v10.4:';
export const STORAGE_VERSION_PREFIX = 'study-v11:';

export function storagePrefixForUser(userId?: string | null): string {
  return userId
    ? `${STORAGE_VERSION_PREFIX}user:${userId}:`
    : `${STORAGE_VERSION_PREFIX}guest:`;
}

export interface StudyStorage {
  load(date: string): StudyRecord | null;
  save(record: StudyRecord): void;
  remove(date: string): void;
  listDates(): string[];
}

/**
 * User-scoped localStorage adapter. The user id is captured in the instance so
 * callers cannot accidentally omit it on individual reads/writes.
 */
export class LocalStudyStorage implements StudyStorage {
  private readonly prefix: string;

  constructor(userId?: string | null) {
    this.prefix = storagePrefixForUser(userId);
  }

  load(date: string): StudyRecord | null {
    const raw = localStorage.getItem(this.prefix + date);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StudyRecord;
    } catch {
      return null;
    }
  }

  save(record: StudyRecord): void {
    localStorage.setItem(this.prefix + record.date, JSON.stringify(record));
  }

  remove(date: string): void {
    localStorage.removeItem(this.prefix + date);
  }

  listDates(): string[] {
    const dates: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(this.prefix)) continue;
      const date = key.slice(this.prefix.length);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.push(date);
    }
    return dates.sort();
  }
}
