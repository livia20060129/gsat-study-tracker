import { CALENDAR_MATH_PLAN } from '../data/mathCalendar';
import type { CalendarMathPlanEntry, CalendarTaskRow, StudyItemFields } from '../types';

export interface CalendarPresetDefinition {
  key: string;
  type: string;
  title: string;
  description: string;
  required: boolean;
  f: StudyItemFields;
}

interface MathSegment extends CalendarMathPlanEntry {
  date: string;
}

const mathSegmentsByTitle = new Map<string, MathSegment[]>();
for (const [date, entry] of Object.entries(CALENDAR_MATH_PLAN)) {
  const list = mathSegmentsByTitle.get(entry.title) ?? [];
  list.push({ ...entry, date });
  mathSegmentsByTitle.set(entry.title, list);
}
for (const list of mathSegmentsByTitle.values()) list.sort((a, b) => a.date.localeCompare(b.date));

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function firstInt(value: string, pattern: RegExp): number | null {
  const match = value.match(pattern);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function parsePageRange(description: string): { start: number; end: number } | null {
  const match = description.match(/(?:範圍[：:]\s*)?p\.?\s*(\d+)\s*[–—~～-]\s*(?:p\.?\s*)?(\d+)/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function calendarImportId(task: CalendarTaskRow): string {
  const match = task.description.match(/排程匯入識別碼[：:]\s*([A-Z0-9_-]+(?:\s*[A-Z0-9_-]+)*)/i);
  return text(match?.[1]).replace(/\s+/g, '') || task.event_key;
}

export function isMathCalendarTask(task: CalendarTaskRow): boolean {
  if (task.category === 'math') return true;
  return /^\s*(?:1|2|3A|4A|2＋4A|2＋3A)｜/.test(task.title);
}

export function mathPlanFromCalendarTask(task: CalendarTaskRow): CalendarMathPlanEntry | null {
  if (!isMathCalendarTask(task)) return null;

  const explicit = parsePageRange(task.description);
  const book = text(task.description.match(/冊別[：:]\s*([^\s]+)/)?.[1]) || text(task.title.split('｜')[0]);
  if (explicit) {
    const pages = explicit.end - explicit.start + 1;
    return {
      title: task.title,
      book,
      start: explicit.start,
      end: explicit.end,
      pages,
      unitPages: pages,
      weekTarget: 0,
    };
  }

  const progress = task.description.match(/單元進度[：:]\s*(\d+)\s*\/\s*(\d+)/);
  const index = progress ? Number(progress[1]) : NaN;
  const total = progress ? Number(progress[2]) : NaN;
  const catalog = mathSegmentsByTitle.get(task.title);
  if (!catalog?.length || !Number.isInteger(index) || index < 1) return null;

  // The current Calendar events contain an explicit unit progress such as 3/9.
  // Map that progress to the original per-unit page segment catalog rather than
  // relying on the event's date. Moving an event to another day therefore keeps
  // the correct textbook pages.
  if (Number.isInteger(total) && total > 0 && total !== catalog.length) return null;
  const segment = catalog[index - 1];
  if (!segment) return null;
  return { ...segment, weekTarget: 0 };
}

function preset(
  task: CalendarTaskRow,
  suffix: string,
  type: string,
  title: string,
  f: StudyItemFields,
): CalendarPresetDefinition {
  return {
    key: `gcal_${calendarImportId(task)}_${suffix}`.replace(/[^A-Za-z0-9_\-]/g, '_'),
    type,
    title,
    description: task.description || `Google Calendar：${task.title}`,
    required: true,
    f: {
      ...f,
      googleCalendarEventId: task.source_event_id,
      googleCalendarEventKey: task.event_key,
      googleCalendarUpdatedAt: task.event_updated_at ?? '',
      calendarSource: 'Google Calendar API',
    },
  };
}

function gujinRounds(title: string): number[] {
  const match = title.match(/第\s*(\d+)(?:\s*[–—~-]\s*(\d+))?\s*回/);
  if (!match) return [];
  const start = Number(match[1]);
  const end = Number(match[2] || match[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end - start > 10) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function parseNaturalIntegrationRanges(description: string): Record<string, Array<[number, number]>> {
  const result: Record<string, Array<[number, number]>> = {};
  const re = /(生物|化學|物理|地科)(?:《[^》]+》)?\s*p\.?\s*(\d+)\s*[–—~-]\s*(\d+)/g;
  for (const match of description.matchAll(re)) {
    const subject = match[1];
    const start = Number(match[2]);
    const end = Number(match[3]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    (result[subject] ??= []).push([Math.min(start, end), Math.max(start, end)]);
  }
  return result;
}

export function calendarTaskToPresetDefinitions(task: CalendarTaskRow): CalendarPresetDefinition[] {
  const title = text(task.title);
  const description = text(task.description);

  const ace = title.match(/^ACE Reading｜第\s*(\d+)\s*回/);
  if (ace) {
    const round = Number(ace[1]);
    return [preset(task, `ace_${round}`, 'extra', `英文｜ACE Reading 第 ${round} 回`, {
      title: 'ACE Reading',
      round: String(round),
    })];
  }

  if (/^古今悅讀一百｜/.test(title)) {
    return gujinRounds(title).map((round) => preset(
      task,
      `gujin_${round}`,
      'chineseReading',
      `國文｜古今悅讀一百 第 ${round} 回`,
      { kind: 'reading', round: String(round) },
    ));
  }

  const writing = title.match(/^英文寫作測驗｜第\s*(\d+)\s*回[：:]?\s*(.*)$/);
  if (writing) {
    const round = Number(writing[1]);
    const focus = text(writing[2]) || text(description.match(/重點[：:]\s*([^\n]+)/)?.[1]);
    return [preset(task, `writing_${round}`, 'extra', `英文｜英文寫作測驗 第 ${round} 回`, {
      title: '英文寫作測驗',
      round: String(round),
      calendarFocus: focus,
    })];
  }

  const grammar = title.match(/^英文文法｜(.+)$/);
  if (grammar) {
    const range = parsePageRange(description);
    const focus = text(description.match(/重點[：:]\s*([^\n]+)/)?.[1]);
    const grammarTitle = text(grammar[1]);
    return [preset(task, 'grammar', 'extra', `英文｜英文文法總複習｜${grammarTitle}`, {
      title: '英文文法總複習講義',
      start: range ? String(range.start) : '',
      end: range ? String(range.end) : '',
      calendarGrammarTitle: grammarTitle,
      calendarRangeText: range ? `p.${range.start}–${range.end}` : '',
      calendarRangeType: 'range',
      calendarFocus: focus,
    })];
  }

  if (/^自然整合｜/.test(title)) {
    const ranges = parseNaturalIntegrationRanges(description);
    const integrationItems = Object.entries(ranges).map(([subject, subjectRanges]) => ({
      subject: subject as '生物' | '化學' | '物理' | '地科',
      material: '123日的淬鍊' as const,
      ranges: subjectRanges,
      pageText: subjectRanges.map(([start, end]) => start === end ? `p.${start}` : `p.${start}–${end}`).join('、'),
    }));
    return [preset(task, 'natural_integration', 'scienceReview', '自然', {
      subject: '混合',
      calendarTopic: title,
      calendarNaturalIntegration: true,
      calendarIntegrationEntries: integrationItems,
      calendarIntegrationReview: text(description.match(/【複習】([^【]+)/)?.[1]),
      calendarIntegrationOutput: text(description.match(/【指定輸出】([^【]+)/)?.[1]),
      calendarIntegrationMinimum: text(description.match(/【最低完成版】([^【]+)/)?.[1]),
      calendarIntegrationTime: firstInt(description, /【時間】\s*(\d+)/),
    })];
  }

  const natural = title.match(/^(物理|化學|生物|地科)｜(.+)$/);
  if (natural) {
    return [preset(task, 'natural', 'scienceReview', '自然', {
      subject: natural[1],
      material: '123日的淬鍊',
      calendarTopic: title,
      calendarTaskText: text(description.match(/任務[：:]\s*([^\n]+)/)?.[1]),
      calendarMinimum: text(description.match(/最低完成版[：:]\s*([^\n]+)/)?.[1]),
    })];
  }

  if (isMathCalendarTask(task)) return [];

  return [];
}

function dateFromString(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function dateString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function mondayOf(date: string): string {
  const value = dateFromString(date);
  const weekday = value.getDay();
  value.setDate(value.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return dateString(value);
}

export function liveCalendarWeekMathTarget(tasks: CalendarTaskRow[], date: string): number | null {
  if (!tasks.length) return null;
  const monday = mondayOf(date);
  const start = dateFromString(monday);
  const dates = new Set<string>();
  for (let i = 0; i < 7; i += 1) {
    const value = new Date(start);
    value.setDate(start.getDate() + i);
    dates.add(dateString(value));
  }

  let found = false;
  let pages = 0;
  for (const task of tasks) {
    if (!dates.has(task.event_date) || !isMathCalendarTask(task)) continue;
    const plan = mathPlanFromCalendarTask(task);
    if (!plan) continue;
    found = true;
    pages += plan.pages;
  }
  return found ? pages : null;
}
