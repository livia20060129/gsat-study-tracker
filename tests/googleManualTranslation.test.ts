import assert from 'node:assert/strict';
import test from 'node:test';
import { dictionaryResult, dictionarySource } from '../src/study/dictionaryEntries.ts';
import { googleTranslationSelection } from '../src/study/googleTranslationSelection.ts';
import { applyGoogleTranslationSelection } from '../src/study/dictionarySelection.ts';
import { applyVocabularyAutoFill, vocabularyAutoFillSources } from '../src/study/vocabularyAutoFill.ts';
import { updateVocabularyWordEntries, vocabularyReviewEntries } from '../src/study/vocabularyReview.ts';
import { vocabularyExportNotices } from '../src/study/vocabularyExportContent.ts';
import { decodeStudyRecord, encodeStudyRecord } from '../src/storage/studyRecordCodec.ts';
import type { EnglishReviewWordEntry, StudyRecord } from '../src/types.ts';

const selection = { word: 'ability', text: '候選中文', partOfSpeech: 'noun' } as const;
function record(word: EnglishReviewWordEntry): StudyRecord {
  return { date: '2026-11-06', notes: '保留筆記', items: [{ id: 'words', type: 'englishVocabInteractive', done: true,
    checkedOn: '2026-11-06', required: false, minutes: '25', f: { words: [word] } }] };
}

test('manual Google selections validate their exact headword and supported POS', () => {
  assert.deepEqual(googleTranslationSelection(selection, ' Ability '), selection);
  assert.equal(googleTranslationSelection(selection, 'other'), null);
  for (const change of [{ word: 'two words' }, { partOfSpeech: 'unknown' }, { text: '' }, { text: 'a'.repeat(2001) }]) {
    assert.equal(googleTranslationSelection({ ...selection, ...change }, 'ability'), null);
  }
  assert.deepEqual(dictionarySource({ provider: 'google', word: 'ability', sourceUrl: 'javascript:alert(1)' }),
    { provider: 'google', word: 'ability', sourceUrl: 'https://translate.google.com/' });
  assert.equal(dictionaryResult({ provider: 'google', word: 'ability', meanings: [] }, 'ability'), null);
});

test('confirming Google appends a meaning, retains manual text and Level, and does not duplicate a second confirmation', () => {
  const word: EnglishReviewWordEntry = { id: 'stable', text: 'ability', noun: true, translation: '手動中文', gsatLevel: 4, showGsatLevel: false };
  assert.equal(applyGoogleTranslationSelection(word, selection), true);
  assert.deepEqual(word.translationsByPartOfSpeech, { noun: ['手動中文', '候選中文'] });
  assert.equal(word.id, 'stable');
  assert.equal(word.gsatLevel, 4);
  assert.equal(word.showGsatLevel, false);
  assert.equal(applyGoogleTranslationSelection(word, selection), false);
});

test('explicit Google results keep ECDICT and Google attribution together in review and both export formats', () => {
  const word: EnglishReviewWordEntry = { text: 'ability' };
  applyVocabularyAutoFill(word, { noun: ['本機中文'] }, 'ECDICT');
  const source = record(word);
  updateVocabularyWordEntries(source, 'ability', { googleSelection: selection });
  assert.deepEqual(vocabularyAutoFillSources(word), { ceec: true, ecdict: true, google: true });
  const entries = vocabularyReviewEntries([source]);
  const notices = vocabularyExportNotices(entries, true).join('\n');
  assert.match(notices, /ECDICT/);
  assert.match(notices, /Translated by Google/);
  const decoded = decodeStudyRecord(encodeStudyRecord(source));
  assert.equal(decoded.ok, true);
  if (decoded.ok) assert.deepEqual(decoded.record.items[0].f.words, [word]);
});

test('confirmed Google additions survive later automatic dictionary lookups and keep unrelated fields', () => {
  const word: EnglishReviewWordEntry = { id: 'stable', text: 'ability', noun: true, translation: '手動中文', vocabularyLookupPending: 'ability' };
  const source = record(word);
  assert.equal(updateVocabularyWordEntries(source, 'ability', { googleSelection: selection }), true);
  assert.equal(word.vocabularyLookupPending, undefined);
  applyVocabularyAutoFill(word, { noun: ['另一個自動結果'] });
  assert.deepEqual(word.translationsByPartOfSpeech, { noun: ['手動中文', '候選中文'] });
  assert.equal(source.notes, '保留筆記');
  assert.equal(source.items[0].minutes, '25');
  assert.equal(source.items[0].checkedOn, '2026-11-06');
});

test('a stale Google selection cannot apply after English spelling or content kind changes', () => {
  for (const word of [{ text: 'differentword' }, { text: 'ability', fixedCombination: true }, { text: 'ability', beautifulSentences: true }]) {
    const before = JSON.stringify(word);
    assert.equal(applyGoogleTranslationSelection(word, selection), false);
    assert.equal(JSON.stringify(word), before);
  }
});

for (const kind of ['組合', '句子'] as const) test(`manual ${kind} translation preserves plain Chinese, flags and attribution through storage and export`, () => {
  const text = kind === '組合' ? 'look after' : 'Practice makes perfect.';
  const word: EnglishReviewWordEntry = { text, fixedCombination: kind === '組合', beautifulSentences: kind === '句子',
    translation: '手動中文', noun: true, gsatLevel: 4, translationsByPartOfSpeech: { noun: ['舊詞性中文'] } };
  const result = { word: text, text: '新的中文', partOfSpeech: 'unclassified', contentKind: kind } as const;
  const source = record(word);
  assert.equal(updateVocabularyWordEntries(source, text.toLowerCase(), { googleSelection: result }), true);
  assert.equal(word.translation, '手動中文\n新的中文');
  assert.equal(word.noun, true);
  assert.equal(word.gsatLevel, 4);
  assert.deepEqual(word.translationsByPartOfSpeech, { noun: ['舊詞性中文'], unclassified: ['新的中文'] });
  assert.equal(applyGoogleTranslationSelection(word, result), false);
  assert.deepEqual(word.dictionarySources, [{ provider: 'google', word: text, sourceUrl: 'https://translate.google.com/' }]);
  const entries = vocabularyReviewEntries([source]);
  assert.ok(vocabularyExportNotices(entries, true).some(value => value.includes('Translated by Google')));
  const decoded = decodeStudyRecord(encodeStudyRecord(source));
  assert.equal(decoded.ok, true);
  if (decoded.ok) assert.deepEqual(decoded.record.items[0].f.words, [word]);
  assert.equal(googleTranslationSelection(result, 'other', kind), null);
  assert.equal(googleTranslationSelection(result, text, kind === '組合' ? '句子' : '組合'), null);
});

test('confirming the same multiline sentence translation twice does not duplicate the block', () => {
  const word = { text: 'A sentence.', beautifulSentences: true, translation: '手動中文' };
  const result = { word: word.text, text: '第一行\n第二行', contentKind: '句子', partOfSpeech: 'unclassified' } as const;
  assert.equal(applyGoogleTranslationSelection(word, result), true);
  assert.equal(applyGoogleTranslationSelection(word, result), false);
  assert.equal(word.translation, '手動中文\n第一行\n第二行');
});
