import type { StudyItem, StudyRecord } from '../types';

const NESTED_ITEM_FIELDS = [
  'makeupEntries',
  'reviewEntries',
  'interactiveEntries',
  'calendarIntegrationEntries',
  'groupedWorkEntries',
  'dailyWorkSourceItems',
] as const;

function legacyWordEntryId(itemId: string, index: number): string {
  return `word:${itemId || 'item'}:${index}`;
}

/**
 * Gives every editable English-review row an immutable identity.
 *
 * Older records stored only mutable text. A deterministic fallback based on
 * the owning item and row index lets local, queued, and cloud copies of the
 * same legacy row receive the same ID before they are merged.
 */
export function ensureEnglishReviewWordEntryIds(record: StudyRecord): boolean {
  let changed = false;
  const visited = new Set<StudyItem>();

  const visit = (item: StudyItem): void => {
    if (!item || visited.has(item)) return;
    visited.add(item);
    item.f ||= {};

    if (Array.isArray(item.f.words)) {
      item.f.words = item.f.words.map((entry, index) => {
        const word = typeof entry === 'string'
          ? { text: entry }
          : entry && typeof entry === 'object' && !Array.isArray(entry)
            ? entry
            : { text: '' };
        if (word !== entry) changed = true;
        if (!String(word.id ?? '').trim()) {
          word.id = legacyWordEntryId(item.id, index);
          changed = true;
        }
        return word;
      });
    }

    for (const field of NESTED_ITEM_FIELDS) {
      const nested = item.f[field];
      if (Array.isArray(nested)) {
        for (const child of nested) visit(child as StudyItem);
      }
    }
  };

  for (const item of record.items || []) visit(item);
  return changed;
}
