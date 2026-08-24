import type { StudyRecord } from '../types';

export interface StudyStorage {
  load(date: string): StudyRecord | null;
  save(record: StudyRecord): void;
}

export class LocalStudyStorage implements StudyStorage {
  constructor(private readonly prefix = 'study-record-') {}

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
}
