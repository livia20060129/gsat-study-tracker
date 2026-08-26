export interface CalendarTaskRow {
  event_key: string;
  source_event_id: string;
  calendar_id: string;
  event_date: string;
  title: string;
  description: string;
  category: string;
  event_updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface ParsedBase {
  eventKey: string;
  sourceEventId: string;
  date: string;
  title: string;
  description: string;
}

export type ParsedCalendarTask =
  | (ParsedBase & { kind: 'math'; book: string; progressIndex: number | null; progressTotal: number | null })
  | (ParsedBase & { kind: 'ace'; rounds: number[] })
  | (ParsedBase & { kind: 'gujin'; rounds: number[] })
  | (ParsedBase & { kind: 'grammar'; startPage: number | null; endPage: number | null; focus: string })
  | (ParsedBase & { kind: 'writing'; round: number | null; focus: string })
  | (ParsedBase & { kind: 'natural'; subject: '物理' | '化學' | '生物' | '地科'; topic: string })
  | (ParsedBase & {
      kind: 'naturalIntegration';
      topic: string;
      review: string;
      pages: string;
      output: string;
      minimum: string;
      time: string;
      pageItems: Array<{ subject: '物理' | '化學' | '生物' | '地科'; start: number; end: number }>;
    })
  | (ParsedBase & { kind: 'other' });

function normalized(value: string): string {
  return value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function roundsFromTitle(title: string): number[] {
  const match = title.match(/第\s*(\d+)\s*(?:[–—~-]\s*(\d+)\s*)?回/);
  if (!match) return [];
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) return [];
  const rounds: number[] = [];
  for (let round = start; round <= end; round += 1) rounds.push(round);
  return rounds;
}

function pageRange(description: string): [number | null, number | null] {
  const match = description.match(/範圍[:：]\s*p\.?\s*(\d+)\s*(?:[–—~-]\s*(\d+))?/i);
  if (!match) return [null, null];
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  return [Number.isFinite(start) ? start : null, Number.isFinite(end) ? end : null];
}

function field(description: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`${escaped}[:：]\\s*([^\\n]+)`));
  return match ? normalized(match[1]) : '';
}

function bracketSection(description: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`【${escaped}】([\\s\\S]*?)(?=\\n?【|$)`));
  return match ? normalized(match[1]) : '';
}

function focusText(title: string, description: string): string {
  const titleSplit = title.split('：');
  if (titleSplit.length > 1) return normalized(titleSplit.slice(1).join('：'));
  return field(description, '重點');
}

function integrationPageItems(description: string) {
  const section = bracketSection(description, '講義／頁碼') || description;
  const items: Array<{ subject: '物理' | '化學' | '生物' | '地科'; start: number; end: number }> = [];
  const regex = /(物理|化學|生物|地科)(?:《123日的淬鍊》)?\s*p\.?\s*(\d+)\s*[–—~-]\s*(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(section))) {
    const start = Number(match[2]);
    const end = Number(match[3]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    items.push({
      subject: match[1] as '物理' | '化學' | '生物' | '地科',
      start: Math.min(start, end),
      end: Math.max(start, end),
    });
  }
  return items;
}

export function parseCalendarTask(row: CalendarTaskRow): ParsedCalendarTask {
  const title = normalized(row.title ?? '');
  const description = row.description ?? '';
  const base: ParsedBase = {
    eventKey: row.event_key,
    sourceEventId: row.source_event_id,
    date: row.event_date,
    title,
    description,
  };

  if (row.category === 'math' || /^(1|2|3A|4A|2＋4A|2＋3A)｜/.test(title)) {
    const progress = description.match(/單元進度[:：]\s*(\d+)\s*\/\s*(\d+)/);
    const bookMatch = description.match(/冊別[:：]\s*([^\s]+)/);
    return {
      ...base,
      kind: 'math',
      book: normalized(bookMatch?.[1] ?? title.split('｜')[0] ?? ''),
      progressIndex: progress ? Number(progress[1]) : null,
      progressTotal: progress ? Number(progress[2]) : null,
    };
  }

  if (row.category === 'ace' || /^ACE Reading｜/.test(title)) {
    return { ...base, kind: 'ace', rounds: roundsFromTitle(title) };
  }

  if (row.category === 'gujin' || /^古今悅讀一百｜/.test(title)) {
    return { ...base, kind: 'gujin', rounds: roundsFromTitle(title) };
  }

  if (row.category === 'grammar' || /^英文文法｜/.test(title)) {
    const [startPage, endPage] = pageRange(description);
    return { ...base, kind: 'grammar', startPage, endPage, focus: field(description, '重點') };
  }

  if (row.category === 'writing' || /^英文寫作測驗｜/.test(title)) {
    const rounds = roundsFromTitle(title);
    return { ...base, kind: 'writing', round: rounds[0] ?? null, focus: focusText(title, description) };
  }

  const natural = title.match(/^(物理|化學|生物|地科)｜(.+)$/);
  if (row.category === 'natural' || natural) {
    if (natural) {
      return {
        ...base,
        kind: 'natural',
        subject: natural[1] as '物理' | '化學' | '生物' | '地科',
        topic: normalized(natural[2]),
      };
    }
  }

  if (row.category === 'naturalIntegration' || /^自然整合｜/.test(title)) {
    return {
      ...base,
      kind: 'naturalIntegration',
      topic: normalized(title.replace(/^自然整合｜/, '')),
      review: bracketSection(description, '複習'),
      pages: bracketSection(description, '講義／頁碼'),
      output: bracketSection(description, '指定輸出'),
      minimum: bracketSection(description, '最低完成版'),
      time: bracketSection(description, '時間'),
      pageItems: integrationPageItems(description),
    };
  }

  return { ...base, kind: 'other' };
}
