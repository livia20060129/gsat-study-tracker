import type { StudyItem } from '../types.ts';
import { contiguousRangeClusters, numericPageRange } from './rangeMerge.ts';

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stableId(items: StudyItem[], kind: string): string {
  return `daily-${kind}-${items.map(item => item.id || item.presetKey || 'item').join('-')}`
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 180);
}

function workIdentity(item: StudyItem): string {
  const fields = item.f || {};
  return JSON.stringify({
    type: item.type,
    title: text(item.title).replace(/\s*第\s*\d+\s*回.*$/, ''),
    material: text(fields.material),
    book: text(fields.book),
    itemTitle: text(fields.title),
    subject: text(fields.subject),
    kind: text(fields.kind),
  });
}

function templateIdentity(item: StudyItem): string {
  return JSON.stringify({
    type: item.type,
    title: text(item.title).replace(/\s*第\s*\d+\s*回.*$/, ''),
  });
}

function isWeekly(item: StudyItem): boolean {
  return item.f?.calendarRoute === 'week';
}

function sourceItems(item: StudyItem): StudyItem[] {
  const sources = item.f?.dailyWorkSourceItems;
  return Array.isArray(sources) && sources.length ? sources : [item];
}

function uniqueText(values: unknown[]): string[] {
  return [...new Set(values.map(text).filter(Boolean))];
}

function preferredBase(items: StudyItem[]): StudyItem {
  return items.find(item => item.required && !item.deferredCarry)
    || items.find(item => !item.deferredCarry)
    || items[0];
}

function combinedItem(items: StudyItem[], kind: string): StudyItem {
  const base = preferredBase(items);
  const sources = items.flatMap(sourceItems);
  const descriptions = uniqueText(items.map(item => item.description));
  return {
    ...base,
    id: stableId(sources, kind),
    done: items.every(item => Boolean(item.done)),
    required: items.some(item => Boolean(item.required)),
    deferredCarry: items.every(item => Boolean(item.deferredCarry)),
    description: descriptions.join('｜'),
    f: {
      ...(base.f || {}),
      dailyWorkGroup: true,
      dailyWorkSourceItems: sources,
      dailyWorkIncludesDeferred: sources.some(item => Boolean(item.deferredCarry)),
    },
  };
}

function mergeRangeCluster(cluster: { items: StudyItem[]; range: { start: number; end: number } | null }): StudyItem {
  if (!cluster.range || cluster.items.length < 2) return cluster.items[0];
  const merged = combinedItem(cluster.items, 'range');
  merged.f.start = String(cluster.range.start);
  merged.f.end = String(cluster.range.end);
  merged.f.dailyWorkMergedRange = true;
  if (merged.f.calendarSuggestedStart !== undefined) merged.f.calendarSuggestedStart = cluster.range.start;
  if (merged.f.calendarSuggestedEnd !== undefined) merged.f.calendarSuggestedEnd = cluster.range.end;
  if (merged.f.calendarDailyPages !== undefined) merged.f.calendarDailyPages = cluster.range.end - cluster.range.start + 1;
  return merged;
}

function groupedChild(item: StudyItem, index: number): StudyItem {
  return {
    ...item,
    id: `${item.id || item.presetKey || 'item'}-daily-child-${index}`,
    calendarGroupedChild: true,
    f: {
      ...(item.f || {}),
      dailyWorkSourceItems: sourceItems(item),
    },
  } as StudyItem;
}

function groupSeparatedRanges(items: StudyItem[]): StudyItem[] {
  const buckets = new Map<string, Array<{ item: StudyItem; index: number }>>();
  items.forEach((item, index) => {
    if (isWeekly(item) || !numericPageRange(item.f) || Array.isArray(item.f?.groupedWorkEntries)) return;
    const key = workIdentity(item);
    const bucket = buckets.get(key) || [];
    bucket.push({ item, index });
    buckets.set(key, bucket);
  });
  const emitted = new Set<string>();
  const output: StudyItem[] = [];
  items.forEach((item, index) => {
    const key = workIdentity(item);
    const bucket = buckets.get(key) || [];
    if (!numericPageRange(item.f) || bucket.length < 2 || isWeekly(item) || Array.isArray(item.f?.groupedWorkEntries)) {
      output.push(item);
      return;
    }
    if (emitted.has(key)) return;
    emitted.add(key);
    const grouped = combinedItem(bucket.map(entry => entry.item), 'separated-range');
    grouped.f.groupedWorkEntries = bucket.map((entry, childIndex) => groupedChild(entry.item, childIndex));
    grouped.done = grouped.f.groupedWorkEntries.every(child => Boolean(child.done));
    output.push(grouped);
  });
  return output;
}

function roundIdentity(item: StudyItem): string {
  if (!text(item.f?.round) || isWeekly(item)) return '';
  return workIdentity(item);
}

function groupRounds(items: StudyItem[]): StudyItem[] {
  const buckets = new Map<string, StudyItem[]>();
  items.forEach(item => {
    const key = roundIdentity(item);
    if (!key || Array.isArray(item.f?.groupedWorkEntries)) return;
    const bucket = buckets.get(key) || [];
    bucket.push(item);
    buckets.set(key, bucket);
  });
  const emitted = new Set<string>();
  const output: StudyItem[] = [];
  for (const item of items) {
    const key = roundIdentity(item);
    const bucket = key ? buckets.get(key) || [] : [];
    if (!key || bucket.length < 2 || Array.isArray(item.f?.groupedWorkEntries)) {
      output.push(item);
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    const byRound = new Map<string, StudyItem[]>();
    bucket.forEach(entry => {
      const round = text(entry.f?.round);
      const sameRound = byRound.get(round) || [];
      sameRound.push(entry);
      byRound.set(round, sameRound);
    });
    if (byRound.size === 1) {
      output.push(combinedItem(bucket, 'same-round'));
      continue;
    }
    const roundItems = [...byRound.values()].map(entries => entries.length > 1 ? combinedItem(entries, 'same-round') : entries[0]);
    const grouped = combinedItem(bucket, 'rounds');
    grouped.title = text(grouped.title).replace(/\s*第\s*\d+\s*回.*$/, '');
    grouped.f.groupedWorkEntries = roundItems.map(groupedChild);
    grouped.done = grouped.f.groupedWorkEntries.every(child => Boolean(child.done));
    output.push(grouped);
  }
  return output;
}

function hasConcreteScope(item: StudyItem): boolean {
  return Boolean(
    numericPageRange(item.f)
    || text(item.f?.round)
    || (Array.isArray(item.f?.groupedWorkEntries) && item.f.groupedWorkEntries.length),
  );
}

function isBlankScheduledTemplate(item: StudyItem): boolean {
  return !isWeekly(item)
    && item.source === 'preset'
    && item.required
    && !item.deferredCarry
    && !hasConcreteScope(item);
}

function templateChildren(item: StudyItem): StudyItem[] {
  const children = item.f?.groupedWorkEntries;
  return Array.isArray(children) && children.length ? children : [item];
}

/**
 * A built-in daily template can be intentionally blank while Calendar or deferred
 * copies of the same work already contain concrete ranges/rounds. Keep one card,
 * but preserve the blank original and every concrete scope as separate completion units.
 */
function groupBlankScheduledTemplates(items: StudyItem[]): StudyItem[] {
  const buckets = new Map<string, StudyItem[]>();
  items.forEach(item => {
    if (isWeekly(item)) return;
    const key = templateIdentity(item);
    const bucket = buckets.get(key) || [];
    bucket.push(item);
    buckets.set(key, bucket);
  });

  const selectedByKey = new Map<string, StudyItem[]>();
  for (const [key, bucket] of buckets) {
    const blanks = bucket.filter(isBlankScheduledTemplate);
    const scoped = bucket.filter(item => !isBlankScheduledTemplate(item) && hasConcreteScope(item));
    if (blanks.length && scoped.length) {
      const selected = new Set([...blanks, ...scoped]);
      selectedByKey.set(key, bucket.filter(item => selected.has(item)));
    }
  }

  const emitted = new Set<string>();
  const output: StudyItem[] = [];
  for (const item of items) {
    const key = templateIdentity(item);
    const selected = selectedByKey.get(key);
    if (!selected || !selected.includes(item)) {
      output.push(item);
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    const grouped = combinedItem(selected, 'scheduled-template');
    grouped.f.groupedWorkEntries = selected.flatMap(templateChildren).map((entry, childIndex) => {
      const child = groupedChild(entry, childIndex);
      if (isBlankScheduledTemplate(entry)) child.f.dailyWorkBlankTemplate = true;
      return child;
    });
    grouped.done = grouped.f.groupedWorkEntries.every(child => Boolean(child.done));
    output.push(grouped);
  }
  return output;
}

/** Restores the original top-level items before Calendar/deferred reconciliation. */
export function ungroupDailyWorkItems(items: StudyItem[]): StudyItem[] {
  return items.flatMap(item => item.f?.dailyWorkGroup ? sourceItems(item) : [item]);
}

/** Final daily pass: merge work regardless of whether it came from Calendar or a deferral. */
export function groupDailyWorkItems(items: StudyItem[]): StudyItem[] {
  const ranged = contiguousRangeClusters(
    items,
    workIdentity,
    item => isWeekly(item) || Array.isArray(item.f?.groupedWorkEntries) ? null : numericPageRange(item.f),
  ).map(mergeRangeCluster);
  return groupBlankScheduledTemplates(groupRounds(groupSeparatedRanges(ranged)));
}

/** Keeps the hidden source records in sync with a merged card or child checkbox. */
export function propagateDailyWorkDone(item: StudyItem, done: boolean): void {
  item.done = done;
  const sources = item.f?.dailyWorkSourceItems;
  if (!Array.isArray(sources)) return;
  sources.forEach(source => {
    source.done = done;
  });
}
