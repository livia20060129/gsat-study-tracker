import type { LocalStudyRecordRepositoryPort } from '../../application/ports/studyRecordRepository.ts';
import type { StudyRecord } from '../../types.ts';
import { decodeStudyRecord, encodeStudyRecord } from '../../storage/studyRecordCodec.ts';

export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Owns local record keys and JSON compatibility so the application never parses storage directly. */
export class LocalStudyRecordRepository implements LocalStudyRecordRepositoryPort {
  private readonly storage: KeyValueStorage;
  private prefix: string;

  constructor(storage: KeyValueStorage, prefix: string) {
    this.storage = storage;
    this.prefix = prefix;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  load(date: string): StudyRecord | null {
    return this.loadFromPrefix(this.prefix, date);
  }

  loadFromPrefix(prefix: string, date: string): StudyRecord | null {
    const raw = this.storage.getItem(prefix + date);
    if (!raw) return null;
    const decoded = decodeStudyRecord(raw, date);
    return decoded.ok ? decoded.record : null;
  }

  save(record: StudyRecord): boolean {
    if (!record?.date) return false;
    try {
      this.storage.setItem(this.prefix + record.date, encodeStudyRecord(record));
      return true;
    } catch {
      return false;
    }
  }

  remove(date: string): void {
    this.storage.removeItem(this.prefix + date);
  }

  listDates(prefix = this.prefix): string[] {
    const dates: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const date = key.slice(prefix.length);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.push(date);
    }
    return dates.sort();
  }
}
