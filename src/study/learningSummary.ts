import type { CompletionMetrics, CompletionUnit } from './completionMetrics.ts';
import {
  groupedMakeupCompletionUnits,
  groupedOriginalCompletionUnits,
  makeupCompletionUnit,
  originalCompletionUnit,
  summarizeCompletionUnits,
} from './completionMetrics.ts';
import { isConfirmedDeferred } from './deferDays.ts';
import { effectiveTemplatePresetKey, specialItemTemplate } from './makeup.ts';
import { studyItemSubject } from './subjectOrder.ts';
import { summarizeSubjectTime, type SubjectTimeSummary } from './subjectTime.ts';
import type { StudyItem, StudyRecord } from '../types.ts';

export const SUMMARY_MODES = ['week', 'month'] as const;
export type SummaryMode = typeof SUMMARY_MODES[number];

const DAY_MS = 86_400_000;

export interface SummaryPeriod {
  mode: SummaryMode;
  anchor: string;
  start: string;
  end: string;
  label: string;
  dates: string[];
}

export interface LearningSummaryDay {
  date: string;
  dayNumber: number;
  weekday: string;
  hasRecord: boolean;
  totalMinutes: number;
  completionPercent: number;
  wakeMinutes: number | null;
}

export interface LearningPeriodSummary {
  period: SummaryPeriod;
  days: LearningSummaryDay[];
  records: StudyRecord[];
  completion: CompletionMetrics;
  subjectTime: SubjectTimeSummary;
  averageWakeMinutes: number | null;
  recordedDayCount: number;
}

function parseDate(value: string): Date {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid study date: ${value}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(value: string, amount: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function mondayKey(value: string): string {
  const date = parseDate(value);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return dateKey(date);
}

function datesBetween(start: string, end: string): string[] {
  const output: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) output.push(cursor);
  return output;
}

function shortDate(value: string, includeYear = false): string {
  const date = parseDate(value);
  const dateText = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  return includeYear ? `${date.getFullYear()}/${dateText}` : dateText;
}

export function summaryPeriod(anchor: string, mode: SummaryMode): SummaryPeriod {
  const normalizedMode = SUMMARY_MODES.includes(mode) ? mode : 'week';
  const anchorDate = parseDate(anchor);
  if (normalizedMode === 'week') {
    const start = mondayKey(anchor);
    const end = addDays(start, 6);
    const sameYear = parseDate(start).getFullYear() === parseDate(end).getFullYear();
    return {
      mode: 'week', anchor, start, end,
      label: `${shortDate(start, true)}－${shortDate(end, !sameYear)}`,
      dates: datesBetween(start, end),
    };
  }
  const startDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 12, 0, 0);
  const endDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 12, 0, 0);
  const start = dateKey(startDate);
  const end = dateKey(endDate);
  return {
    mode: 'month', anchor, start, end,
    label: `${anchorDate.getFullYear()} 年 ${anchorDate.getMonth() + 1} 月`,
    dates: datesBetween(start, end),
  };
}

export function shiftSummaryAnchor(anchor: string, mode: SummaryMode, direction: -1 | 1): string {
  const date = parseDate(anchor);
  if (mode === 'week') date.setDate(date.getDate() + direction * 7);
  else date.setMonth(date.getMonth() + direction, 1);
  return dateKey(date);
}

function childItems(item: StudyItem, key: string): StudyItem[] {
  const value = item.f?.[key];
  return Array.isArray(value) ? value.filter(Boolean) as StudyItem[] : [];
}

function groupedChildren(item: StudyItem): StudyItem[] {
  return childItems(item, 'groupedWorkEntries');
}

function confirmedDeferred(item: StudyItem): boolean {
  return isConfirmedDeferred(item);
}

function isWeeklyCalendarItem(item: StudyItem): boolean {
  return item.source === 'preset' && item.f?.calendarRoute === 'week';
}

function visibleItems(record: StudyRecord): StudyItem[] {
  const items = Array.isArray(record.items) ? record.items : [];
  return items.filter(item => !(record.mood === '外出' && item?.source === 'preset'));
}

function isSaturdayMakeup(item: StudyItem): boolean {
  return item.type === 'general'
    && (effectiveTemplatePresetKey(item) === 'sat_makeup' || item.title === '回補本週未完成項目');
}

function isInteractiveDaily(item: StudyItem): boolean {
  return specialItemTemplate(item) === 'interactiveDaily';
}

function isCalendarNaturalIntegration(item: StudyItem): boolean {
  return Boolean(item.f?.calendarNaturalIntegration && childItems(item, 'calendarIntegrationEntries').length);
}

function isCalendarMakeup(item: StudyItem): boolean {
  return item.source === 'preset' && item.f?.calendarMakeup === true;
}

function hasMergedCalendarMakeup(item: StudyItem): boolean {
  return item.f?.calendarIncludesMakeup === true;
}

/** Maps a stored Tracker record onto the existing completion-metric primitives. */
export function summaryCompletionUnitsForRecord(record: StudyRecord): CompletionUnit[] {
  const units: CompletionUnit[] = [];
  for (const item of visibleItems(record)) {
    if (!item || isWeeklyCalendarItem(item)) continue;
    const grouped = groupedChildren(item);
    if (grouped.length) {
      for (const child of grouped) {
        const deferred = confirmedDeferred(item) || confirmedDeferred(child);
        units.push(...(
          item.deferredCarry || child.deferredCarry || child.required === false
            ? groupedMakeupCompletionUnits([Boolean(child.done)], deferred)
            : groupedOriginalCompletionUnits([Boolean(child.done)], deferred)
        ));
      }
      continue;
    }
    if (item.deferredCarry) {
      let completed = Boolean(item.done);
      const interactive = childItems(item, 'interactiveEntries');
      const integration = childItems(item, 'calendarIntegrationEntries');
      if (interactive.length) completed = interactive.every(child => Boolean(child.done));
      else if (integration.length) completed = integration.every(child => Boolean(child.done));
      units.push(makeupCompletionUnit(completed, confirmedDeferred(item)));
      continue;
    }
    if (!item.required) {
      const eligible = item.source === 'custom' || isCalendarMakeup(item) || hasMergedCalendarMakeup(item);
      if (eligible && item.type && specialItemTemplate(item) !== 'englishReview') {
        units.push(makeupCompletionUnit(Boolean(item.done), confirmedDeferred(item)));
      }
      continue;
    }
    if (isSaturdayMakeup(item)) {
      units.push(originalCompletionUnit(Boolean(item.done), confirmedDeferred(item)));
      for (const child of childItems(item, 'makeupEntries')) {
        if (child?.type) units.push(makeupCompletionUnit(Boolean(child.done), confirmedDeferred(item) || confirmedDeferred(child)));
      }
      continue;
    }
    if (isInteractiveDaily(item)) {
      const children = childItems(item, 'interactiveEntries');
      const completed = children.length > 0 && children.every(child => Boolean(child.done));
      units.push(originalCompletionUnit(completed, confirmedDeferred(item)));
      if (hasMergedCalendarMakeup(item)) units.push(makeupCompletionUnit(completed, confirmedDeferred(item)));
      continue;
    }
    if (isCalendarNaturalIntegration(item)) {
      const children = childItems(item, 'calendarIntegrationEntries');
      for (const child of children) {
        units.push({ ...originalCompletionUnit(Boolean(child.done), confirmedDeferred(item)), workloadIncluded: false });
      }
      units.push(makeupCompletionUnit(children.every(child => Boolean(child.done)), confirmedDeferred(item)));
      continue;
    }
    units.push(originalCompletionUnit(Boolean(item.done), confirmedDeferred(item)));
    if (hasMergedCalendarMakeup(item)) units.push(makeupCompletionUnit(Boolean(item.done), confirmedDeferred(item)));
  }
  return units;
}

function numericMinutes(value: unknown): number {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function collectCompletedTime(item: StudyItem, output: Array<{ subject: string; minutes: number }>): void {
  const grouped = groupedChildren(item);
  if (grouped.length) {
    grouped.forEach(child => collectCompletedTime(child, output));
    return;
  }
  const interactive = childItems(item, 'interactiveEntries');
  if (interactive.length) {
    interactive.forEach(child => collectCompletedTime(child, output));
    return;
  }
  const integration = childItems(item, 'calendarIntegrationEntries');
  if (integration.length) {
    integration.forEach(child => collectCompletedTime(child, output));
    return;
  }
  if (isSaturdayMakeup(item)) {
    childItems(item, 'makeupEntries').forEach(child => collectCompletedTime(child, output));
    return;
  }
  const reviewEntries = childItems(item, 'reviewEntries');
  if (reviewEntries.length) {
    reviewEntries.forEach(child => collectCompletedTime(child, output));
    return;
  }
  if (!item.done) return;
  if (specialItemTemplate(item) === 'fixedMagazine') {
    const entries = Array.isArray(item.f?.entries) ? item.f.entries as Array<{ minutes?: unknown }> : [];
    const minutes = entries.reduce((sum, entry) => sum + numericMinutes(entry?.minutes), 0);
    if (minutes > 0) output.push({ subject: studyItemSubject(item), minutes });
    return;
  }
  const minutes = numericMinutes(item.minutes);
  if (minutes > 0) output.push({ subject: studyItemSubject(item), minutes });
}

export function completedSubjectTimeForRecord(record: StudyRecord): SubjectTimeSummary {
  const entries: Array<{ subject: string; minutes: number }> = [];
  visibleItems(record).filter(item => !isWeeklyCalendarItem(item)).forEach(item => collectCompletedTime(item, entries));
  return summarizeSubjectTime(entries);
}

export function wakeTimeMinutes(value: unknown): number | null {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null;
}

export function summarizeLearningPeriod(records: StudyRecord[], period: SummaryPeriod): LearningPeriodSummary {
  const byDate = new Map(records.map(record => [record.date, record]));
  const periodRecords = period.dates.map(date => byDate.get(date)).filter(Boolean) as StudyRecord[];
  const allUnits = periodRecords.flatMap(summaryCompletionUnitsForRecord);
  const subjectEntries: Array<{ subject: string; minutes: number }> = [];
  const wakeValues: number[] = [];
  const days = period.dates.map(date => {
    const record = byDate.get(date);
    if (!record) {
      return {
        date, dayNumber: parseDate(date).getDate(), weekday: ['日', '一', '二', '三', '四', '五', '六'][parseDate(date).getDay()],
        hasRecord: false, totalMinutes: 0, completionPercent: 0, wakeMinutes: null,
      };
    }
    const completion = summarizeCompletionUnits(summaryCompletionUnitsForRecord(record));
    const subjectTime = completedSubjectTimeForRecord(record);
    subjectTime.slices.forEach(slice => subjectEntries.push({ subject: slice.subject, minutes: slice.minutes }));
    const wakeMinutes = wakeTimeMinutes(record.wakeTime);
    if (wakeMinutes !== null) wakeValues.push(wakeMinutes);
    return {
      date, dayNumber: parseDate(date).getDate(), weekday: ['日', '一', '二', '三', '四', '五', '六'][parseDate(date).getDay()],
      hasRecord: true, totalMinutes: subjectTime.totalMinutes,
      completionPercent: completion.settlementPercent, wakeMinutes,
    };
  });
  return {
    period,
    days,
    records: periodRecords,
    completion: summarizeCompletionUnits(allUnits),
    subjectTime: summarizeSubjectTime(subjectEntries),
    averageWakeMinutes: wakeValues.length ? Math.round(wakeValues.reduce((sum, value) => sum + value, 0) / wakeValues.length) : null,
    recordedDayCount: periodRecords.length,
  };
}

export function formatClockMinutes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const normalized = Math.round(value);
  return `${String(Math.floor(normalized / 60) % 24).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function calendarLeadingBlankCount(period: SummaryPeriod): number {
  if (period.mode !== 'month') return 0;
  const weekday = parseDate(period.start).getDay();
  return weekday === 0 ? 6 : weekday - 1;
}

