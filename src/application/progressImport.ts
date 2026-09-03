import type { StudyRecord } from '../types.ts';

export type ProgressImportRecord = Record<string, unknown> & { date: string };

export type ProgressImportParseResult =
  | { ok: true; records: ProgressImportRecord[] }
  | { ok: false; errors: string[] };

export interface ProgressImportCommitSummary {
  localSucceeded: number;
  localFailed: number;
  cloudSucceeded: number;
  cloudConflicts: number;
  cloudFailed: number;
  cloudSkipped: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function validateItems(value: unknown, label: string, errors: string[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${label}的 items 必須是陣列。`);
    return;
  }
  value.forEach((item, itemIndex) => {
    if (!isObject(item)) {
      errors.push(`${label}的第 ${itemIndex + 1} 個項目格式不正確。`);
      return;
    }
    if (item.f !== undefined && !isObject(item.f)) {
      errors.push(`${label}的第 ${itemIndex + 1} 個項目欄位 f 必須是物件。`);
    }
  });
}

function recordFrom(
  value: unknown,
  label: string,
  dateHint: string,
  errors: string[],
): ProgressImportRecord | null {
  if (!isObject(value)) {
    errors.push(`${label}必須是物件。`);
    return null;
  }

  const suppliedDate = String(value.date ?? '').trim();
  if (dateHint && suppliedDate && suppliedDate !== dateHint) {
    errors.push(`${label}的日期 ${suppliedDate} 與外層日期 ${dateHint} 不一致。`);
    return null;
  }
  const date = suppliedDate || dateHint;
  if (!isCalendarDate(date)) {
    errors.push(`${label}缺少有效的 YYYY-MM-DD 日期。`);
    return null;
  }

  validateItems(value.items, label, errors);
  const output = cloneRecord(value) as ProgressImportRecord;
  output.date = date;
  return output;
}

/**
 * Parses every supported import shape without mutating storage. If any record
 * is malformed the complete batch is rejected, preventing partial imports.
 */
export function parseProgressImportText(text: string): ProgressImportParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['內容不是有效的 JSON。'] };
  }

  const errors: string[] = [];
  const records: ProgressImportRecord[] = [];
  const add = (entry: unknown, label: string, dateHint = '') => {
    const record = recordFrom(entry, label, dateHint, errors);
    if (record) records.push(record);
  };

  if (Array.isArray(value)) {
    value.forEach((entry, index) => add(entry, `第 ${index + 1} 筆紀錄`));
  } else if (isObject(value) && Object.prototype.hasOwnProperty.call(value, 'records')) {
    if (!Array.isArray(value.records)) {
      errors.push('records 必須是陣列。');
    } else {
      value.records.forEach((entry, index) => add(entry, `第 ${index + 1} 筆紀錄`));
    }
  } else if (isObject(value) && value.date !== undefined) {
    add(value, '紀錄');
  } else if (isObject(value)) {
    const dateKeys = Object.keys(value).filter(isCalendarDate);
    if (!dateKeys.length) errors.push('找不到有效的 YYYY-MM-DD 日期紀錄。');
    dateKeys.forEach((date) => add(value[date], `${date} 紀錄`, date));
  } else {
    errors.push('匯入內容必須是單筆紀錄、多筆陣列或日期對應物件。');
  }

  if (!records.length && !errors.length) errors.push('找不到可匯入的進度紀錄。');
  return errors.length ? { ok: false, errors } : { ok: true, records };
}

export function progressImportResultText(summary: ProgressImportCommitSummary): string {
  const local = summary.localFailed
    ? `本機成功 ${summary.localSucceeded} 筆、失敗 ${summary.localFailed} 筆`
    : `本機成功 ${summary.localSucceeded} 筆`;
  const cloudTotal = summary.cloudSucceeded
    + summary.cloudConflicts
    + summary.cloudFailed
    + summary.cloudSkipped;
  if (!cloudTotal) return `${local}。`;
  return `${local}；雲端成功 ${summary.cloudSucceeded} 筆、衝突 ${summary.cloudConflicts} 筆、失敗 ${summary.cloudFailed} 筆、未同步 ${summary.cloudSkipped} 筆。`;
}

export function progressImportBackupPayload(
  records: StudyRecord[],
  createdAt = new Date().toISOString(),
): { version: 1; createdAt: string; records: StudyRecord[] } {
  return {
    version: 1,
    createdAt,
    records: JSON.parse(JSON.stringify(records)) as StudyRecord[],
  };
}
