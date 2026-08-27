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
  route?: 'today' | 'week';
  makeup?: boolean;
}

export type ParsedCalendarTask =
  | (ParsedBase & { kind: 'math'; book: string; progressIndex: number | null; progressTotal: number | null })
  | (ParsedBase & { kind: 'ace'; rounds: number[] })
  | (ParsedBase & { kind: 'gujin'; rounds: number[] })
  | (ParsedBase & { kind: 'grammar'; startPage: number | null; endPage: number | null; focus: string })
  | (ParsedBase & { kind: 'essentialGrammar'; units: number[] })
  | (ParsedBase & { kind: 'writing'; round: number | null; focus: string })
  | (ParsedBase & { kind: 'fixedTemplate'; template: CalendarFixedTemplate })
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
  | (ParsedBase & { kind: 'calendarItem' })
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

export type CalendarFixedTemplate =
  | 'mathStudy'
  | 'mathPractice'
  | 'interactiveDaily'
  | 'fixedMagazine'
  | 'englishReview'
  | 'englishMixedWriting'
  | 'englishMockTimed'
  | 'englishMockCorrection'
  | 'weekReview'
  | 'englishLightReading';

/** Matches the stable template name while allowing date, range, and makeup notes after it. */
export function calendarFixedTemplate(value: string): CalendarFixedTemplate | null {
  const title = normalized(value);
  if (/^數學講義題目：理解檢查＋錯題標記＋訂正(?:$|｜)/.test(title)) return 'mathPractice';
  if (/^數學講義：進度(?:$|｜)/.test(title)) return 'mathStudy';
  if (/^互動題(?:$|｜)/.test(title)) return 'interactiveDaily';
  if (/^學測英文訓練：英文雜誌(?:$|｜)/.test(title)) return 'fixedMagazine';
  if (/^英文訂正與搭配詞整理(?:$|｜)/.test(title)) return 'englishReview';
  if (/^英文：混合題與作文練習(?:$|｜)/.test(title)) return 'englishMixedWriting';
  if (/^英文歷屆／模考\s*[｜:：]\s*限時作答(?:$|｜)/.test(title)) return 'englishMockTimed';
  if (/^英文歷屆／模考\s*[｜:：]\s*批改與訂正(?:$|｜)/.test(title)) return 'englishMockCorrection';
  if (/^本週完成度與錯題整理(?:$|｜)/.test(title)) return 'weekReview';
  if (/^英文輕量閱讀(?:$|｜)/.test(title)) return 'englishLightReading';
  return null;
}

function expandEssentialGrammarUnits(value: string): number[] {
  const units: number[] = [];
  const seen = new Set<number>();
  const ranges = /(\d{1,3})(?:\s*(?:[–—~-]|到|至)\s*(\d{1,3}))?/g;
  let match: RegExpExecArray | null;
  while ((match = ranges.exec(value))) {
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) continue;
    for (let unit = start; unit <= Math.min(end, 115); unit += 1) {
      if (!seen.has(unit)) {
        seen.add(unit);
        units.push(unit);
      }
    }
  }
  return units;
}

function essentialGrammarUnits(title: string, description: string): number[] {
  const sources = `${title}\n${description}`;
  const captures: string[] = [];
  const patterns = [
    /(?:Units?|單元)\s*[:：#]?\s*([0-9、，,及和到至–—~\- \t]+)/gi,
    /第\s*([0-9、，,及和到至–—~\- \t]+)\s*(?:Units?|單元)/gi,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sources))) captures.push(match[1]);
  }
  if (!captures.length) {
    captures.push(title.replace(/Essential Grammar in Use/gi, ''));
  }
  return expandEssentialGrammarUnits(captures.join('、'));
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
  const rawTitle = normalized(row.title ?? '');
  const routed = rawTitle.match(/^(今日項目|今日|本週項目|本周項目|本週|本周)｜(.+)$/);
  const routedTitle = normalized(routed?.[2] ?? rawTitle);
  const makeupPrefix = routedTitle.match(/^(補做項目|補做)\s*[｜:：]\s*(.+)$/);
  const title = normalized(makeupPrefix?.[2] ?? routedTitle);
  const makeup = Boolean(makeupPrefix) || /補做(?:項目)?\s*(?:\d|[｜:：]|$)/.test(title);
  const route: 'today' | 'week' | undefined = makeup
    ? 'today'
    : routed
    ? (/^(本週|本周)/.test(routed[1]) ? 'week' : 'today')
    : undefined;
  const description = row.description ?? '';
  const base: ParsedBase = {
    eventKey: row.event_key,
    sourceEventId: row.source_event_id,
    date: row.event_date,
    title,
    description,
    ...(route ? { route } : {}),
    ...(makeup ? { makeup: true } : {}),
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

  if (row.category === 'essentialGrammar' || /Essential Grammar in Use/i.test(title)) {
    return { ...base, route: route ?? 'today', kind: 'essentialGrammar', units: essentialGrammarUnits(title, description) };
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

  const fixedTemplate = calendarFixedTemplate(title);
  if (fixedTemplate) {
    return { ...base, kind: 'fixedTemplate', template: fixedTemplate };
  }

  return { ...base, route: route ?? 'today', kind: 'calendarItem' };
}
