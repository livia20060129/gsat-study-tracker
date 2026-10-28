import { OVERDUE_TASK_SUBJECTS, type OverdueItemSubject } from './overdueTasks.ts';

interface FilterableEntry {
  subject: OverdueItemSubject;
  subjectLabel: string;
  title: string;
}

export interface OverdueItemOption {
  value: string;
  label: string;
}

export function overdueItemKey(entry: FilterableEntry): string {
  return `${entry.subject}:${entry.title.trim() || '未命名項目'}`;
}

export function normalizedOverdueItemFilter(value: unknown): string {
  if (typeof value !== 'string') return '';
  const separator = value.indexOf(':');
  const subject = value.slice(0, separator);
  const title = value.slice(separator + 1).trim();
  if (!OVERDUE_TASK_SUBJECTS.some(candidate => candidate !== 'all' && candidate === subject) || !title) return '';
  return `${subject}:${title}`;
}

/** Group the same title across dates, keeping identically named subjects separate. */
export function overdueItemOptions(entries: readonly FilterableEntry[]): OverdueItemOption[] {
  const distinct = new Map<string, FilterableEntry>();
  for (const entry of entries) distinct.set(overdueItemKey(entry), entry);
  const sorted = [...distinct.entries()].sort(function compareEntries([leftKey, left], [rightKey, right]): number {
    const subjectOrder = OVERDUE_TASK_SUBJECTS.indexOf(left.subject) - OVERDUE_TASK_SUBJECTS.indexOf(right.subject);
    return subjectOrder || leftKey.localeCompare(rightKey, 'zh-TW', { numeric: true });
  });
  return sorted.map(([value, entry]) => ({ value, label: `${entry.subjectLabel}｜${entry.title.trim() || '未命名項目'}` }));
}

export function overdueEntriesForItem<T extends FilterableEntry>(entries: readonly T[], selected: string): T[] {
  if (!selected) return [...entries];
  return entries.filter(entry => overdueItemKey(entry) === selected);
}
