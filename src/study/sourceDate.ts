import type { StudyItem } from '../types.ts';

function values(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function displayDate(value: unknown): string {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(?:\d{4}[-/])?(\d{1,2})[-/](\d{1,2})$/);
  return match ? `${Number(match[1])}/${Number(match[2])}` : raw;
}

/** Collects the original dates represented by a Calendar/deferred aggregate. */
export function groupedSourceDateText(item: StudyItem, fallbackDate = ''): string {
  const dates = new Set<string>();
  const visited = new Set<StudyItem>();
  const add = (value: unknown): void => {
    for (const candidate of values(value)) {
      const label = displayDate(candidate);
      if (label) dates.add(label);
    }
  };
  const visit = (candidate: StudyItem): void => {
    if (!candidate || visited.has(candidate)) return;
    visited.add(candidate);
    add(candidate.deferredOriginDates);
    add(candidate.deferredOriginDate);
    add(candidate.f?.calendarSourceDates);
    add(candidate.f?.calendarSourceDate);
    const sources = candidate.f?.dailyWorkSourceItems;
    if (Array.isArray(sources)) sources.forEach(visit);
    const children = candidate.f?.groupedWorkEntries;
    if (Array.isArray(children)) children.forEach(visit);
  };
  visit(item);
  if (!dates.size) add(fallbackDate);
  return [...dates].sort((a, b) => {
    const [am, ad] = a.split('/').map(Number);
    const [bm, bd] = b.split('/').map(Number);
    return Number.isFinite(am) && Number.isFinite(ad) && Number.isFinite(bm) && Number.isFinite(bd)
      ? am - bm || ad - bd
      : a.localeCompare(b);
  }).join('、') || '—';
}

/** True when a child includes Tracker deferral or Calendar makeup work. */
export function hasDeferredStudySource(item: StudyItem): boolean {
  const visited = new Set<StudyItem>();
  const visit = (candidate: StudyItem): boolean => {
    if (!candidate || visited.has(candidate)) return false;
    visited.add(candidate);
    if (candidate.deferredCarry || candidate.deferred === true || candidate.f?.calendarMakeup === true
      || candidate.f?.dailyWorkIncludesDeferred === true) return true;
    const sources = candidate.f?.dailyWorkSourceItems;
    if (Array.isArray(sources) && sources.some(visit)) return true;
    const children = candidate.f?.groupedWorkEntries;
    return Array.isArray(children) && children.some(visit);
  };
  return visit(item);
}
