import { bookUnitNumbers, unitBook, unitBookSections } from '../data/unitBooks.ts';
import type { StudyItem } from '../types.ts';
import { propagateDailyWorkField } from './dailyWorkGroup.ts';

export interface BookUnitRange {
  start: string;
  end: string;
}

export function bookUnitRange(item: StudyItem): BookUnitRange {
  const fields = item.f ?? {};
  const book = unitBook(fields.title || fields.book || item.title);
  if (!book) return { start: '', end: '' };
  const start = String(fields.unitStart ?? fields.unit ?? '').trim();
  const end = String(fields.unitEnd ?? start).trim();
  if (Object.prototype.hasOwnProperty.call(fields, 'unitStart')
    || Object.prototype.hasOwnProperty.call(fields, 'unitEnd') || start || end) return { start, end: end || start };
  const units = bookUnitNumbers(`${fields.calendarUnitProgress ?? ''}\n${item.title ?? ''}\n${item.description ?? ''}`, book.total);
  if (units.length) return { start: String(units[0]), end: String(units.at(-1)) };
  const sections = unitBookSections(book.title).filter(section => (
    Number(fields.start) > 0 && Number(fields.start) <= section.end
    && Number(fields.end || fields.start) >= section.start
  ));
  if (sections.length) return { start: String(sections[0].unit), end: String(sections.at(-1)!.unit) };
  return { start: '', end: '' };
}

export function bookUnitText(item: StudyItem): string {
  const range = bookUnitRange(item);
  if (!range.start) return '尚未填寫 Unit。';
  const label = range.start === range.end ? `Unit ${range.start}` : `Unit ${range.start}–${range.end}`;
  const topics = unitBookSections(item.f.title || item.f.book).filter(section => (
    section.unit >= Number(range.start) && section.unit <= Number(range.end)
  )).map(section => section.title);
  return [label, ...topics].join('｜');
}

export function validBookUnitRange(item: StudyItem, start: string, end: string): boolean {
  const book = unitBook(item.f.title || item.f.book);
  if (!book) return false;
  if (start === '' && end === '') return true;
  const effectiveEnd = end || start;
  return /^\d+$/.test(start) && Number(start) >= 1
    && /^\d+$/.test(effectiveEnd) && Number(effectiveEnd) >= Number(start) && Number(effectiveEnd) <= book.total;
}

/** Keep original page fields intact; Unit edits are stored on their own fields and source rows. */
export function applyBookUnitRange(item: StudyItem, start: string, end: string): void {
  start = start ? String(Number(start)) : '';
  end = end ? String(Number(end)) : start;
  propagateDailyWorkField(item, 'unitStart', start);
  propagateDailyWorkField(item, 'unitEnd', end);
  const overrides = item.f.dailyWorkUserFields;
  propagateDailyWorkField(item, 'dailyWorkUserFields', {
    ...(overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {}),
    unitStart: start, unitEnd: end,
  });
}
