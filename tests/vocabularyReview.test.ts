import test from 'node:test';
import assert from 'node:assert/strict';
import {
  oxfordLookupQuery,
  oxfordSearchUrl,
  vocabularyReviewEntries,
} from '../src/study/vocabularyReview.ts';
import type { StudyItem, StudyRecord } from '../src/types.ts';

function item(id: string, words: StudyItem['f']['words'], nested: StudyItem[] = []): StudyItem {
  return {
    id,
    type: 'englishVocabInteractive',
    done: false,
    minutes: '',
    required: false,
    f: { words, interactiveEntries: nested },
  };
}

function record(date: string, items: StudyItem[]): StudyRecord {
  return { date, items };
}

test('collects editable words from daily and nested items and sorts them alphabetically', () => {
  const entries = vocabularyReviewEntries([
    record('2026-09-20', [item('later', [{ text: 'novelty', noun: true }])]),
    record('2026-09-19', [item('first', [
      { text: 'pay an insurance premium', fixedCombination: true },
      { text: ' leverage ', verb: true },
    ], [item('nested', [{ text: 'adversity', noun: true }])])]),
  ]);

  assert.deepEqual(entries.map(entry => entry.text), [
    'adversity',
    'leverage',
    'novelty',
    'pay an insurance premium',
  ]);
  assert.deepEqual(entries.find(entry => entry.text === 'adversity')?.sourceDates, ['2026-09-19']);
});

test('merges repeated words without losing tags, dates, or occurrence count', () => {
  const entries = vocabularyReviewEntries([
    record('2026-09-19', [item('one', [{ text: 'Leverage', noun: true }])]),
    record('2026-09-20', [item('two', [{ text: ' leverage ', verb: true }])]),
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].text, 'Leverage');
  assert.equal(entries[0].occurrenceCount, 2);
  assert.deepEqual(entries[0].sourceDates, ['2026-09-19', '2026-09-20']);
  assert.deepEqual(entries[0].tags, ['Noun', 'Verb']);
});

test('uses the longest useful English run for an Oxford search link', () => {
  assert.equal(oxfordLookupQuery('leverage + 資源 + to V'), 'leverage');
  assert.equal(oxfordLookupQuery('pay an insurance premium'), 'pay an insurance premium');
  assert.equal(oxfordLookupQuery('v. accomplish'), 'accomplish');
  assert.equal(oxfordSearchUrl('pay an insurance premium'),
    'https://www.oxfordlearnersdictionaries.com/search/english/?q=pay%20an%20insurance%20premium');
  assert.equal(oxfordSearchUrl('純中文備註'), '');
});

test('keeps non-English rows under the fallback group without making an invalid link', () => {
  const entries = vocabularyReviewEntries([
    record('2026-09-19', [item('note', ['純中文備註'])]),
  ]);

  assert.equal(entries[0].letter, '#');
  assert.equal(entries[0].lookupUrl, '');
});
