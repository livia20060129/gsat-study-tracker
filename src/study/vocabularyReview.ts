import type { EnglishReviewWordEntry, StudyItem, StudyRecord } from '../types.ts';

const NESTED_ITEM_FIELDS = [
  'makeupEntries',
  'reviewEntries',
  'interactiveEntries',
  'calendarIntegrationEntries',
  'groupedWorkEntries',
  'dailyWorkSourceItems',
] as const;

export const VOCABULARY_TAGS = [
  ['noun', 'Noun'],
  ['verb', 'Verb'],
  ['adjective', 'Adjective'],
  ['adverb', 'Adverb'],
  ['preposition', 'Preposition'],
  ['conjunction', 'Conjunction'],
  ['fixedCombination', 'Fixed combination'],
  ['beautifulSentences', 'Beautiful sentences'],
] as const;

export interface VocabularyReviewEntry {
  key: string;
  text: string;
  lookupQuery: string;
  lookupUrl: string;
  letter: string;
  tags: string[];
  sourceDates: string[];
  occurrenceCount: number;
}

interface MutableVocabularyReviewEntry extends Omit<VocabularyReviewEntry, 'tags' | 'sourceDates'> {
  tags: Set<string>;
  sourceDates: Set<string>;
}

function normalizedWordText(value: unknown): string {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function vocabularyKey(value: string): string {
  return value.toLocaleLowerCase('en-US');
}

function englishRuns(value: string): string[] {
  return value.match(/[A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z][A-Za-z'’.-]*)*/g) ?? [];
}

function withoutPartOfSpeechPrefix(value: string): string {
  return value
    .replace(/^(?:n|v|adj|adv|prep|conj)\.?\s+/i, '')
    .replace(/[.]+$/g, '')
    .trim();
}

/** Returns the most useful English word or phrase contained in an editable row. */
export function oxfordLookupQuery(value: unknown): string {
  const text = normalizedWordText(value);
  const candidates = englishRuns(text)
    .map(withoutPartOfSpeechPrefix)
    .filter(candidate => /[A-Za-z]/.test(candidate));
  return candidates.sort((left, right) => right.length - left.length)[0] ?? '';
}

export function oxfordSearchUrl(value: unknown): string {
  const query = oxfordLookupQuery(value);
  return query
    ? `https://www.oxfordlearnersdictionaries.com/search/english/?q=${encodeURIComponent(query)}`
    : '';
}

function vocabularyLetter(query: string): string {
  const match = query.match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : '#';
}

function wordObject(value: string | EnglishReviewWordEntry): EnglishReviewWordEntry {
  return typeof value === 'string' ? { text: value } : value;
}

function collectItemWords(
  item: StudyItem,
  date: string,
  entries: Map<string, MutableVocabularyReviewEntry>,
  visited: Set<object>,
): void {
  if (!item || typeof item !== 'object' || visited.has(item)) return;
  visited.add(item);

  if (Array.isArray(item.f?.words)) {
    for (const rawWord of item.f.words) {
      const word = wordObject(rawWord);
      const text = normalizedWordText(word.text);
      if (!text) continue;
      const key = vocabularyKey(text);
      const lookupQuery = oxfordLookupQuery(text);
      let entry = entries.get(key);
      if (!entry) {
        entry = {
          key,
          text,
          lookupQuery,
          lookupUrl: oxfordSearchUrl(text),
          letter: vocabularyLetter(lookupQuery),
          tags: new Set<string>(),
          sourceDates: new Set<string>(),
          occurrenceCount: 0,
        };
        entries.set(key, entry);
      }
      entry.occurrenceCount += 1;
      if (date) entry.sourceDates.add(date);
      for (const [field, label] of VOCABULARY_TAGS) {
        if (word[field] === true) entry.tags.add(label);
      }
    }
  }

  for (const field of NESTED_ITEM_FIELDS) {
    const nested = item.f?.[field];
    if (!Array.isArray(nested)) continue;
    for (const child of nested) collectItemWords(child as StudyItem, date, entries, visited);
  }
}

export function vocabularyReviewEntries(records: StudyRecord[]): VocabularyReviewEntry[] {
  const entries = new Map<string, MutableVocabularyReviewEntry>();
  const orderedRecords = [...records].sort((left, right) => left.date.localeCompare(right.date));
  for (const record of orderedRecords) {
    const visited = new Set<object>();
    for (const item of record.items ?? []) collectItemWords(item, record.date, entries, visited);
  }

  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  return [...entries.values()]
    .map(entry => ({
      ...entry,
      tags: [...entry.tags],
      sourceDates: [...entry.sourceDates].sort(),
    }))
    .sort((left, right) => {
      if (left.letter === '#' && right.letter !== '#') return 1;
      if (left.letter !== '#' && right.letter === '#') return -1;
      return collator.compare(left.lookupQuery || left.text, right.lookupQuery || right.text);
    });
}
