import type { EnglishReviewWordEntry } from '../types.ts';
import { dictionaryResult, dictionarySource, type DictionaryLookupResult, type DictionarySourceReference } from './dictionaryEntries.ts';
import { normalizedVocabularyTranslations, VOCABULARY_PARTS_OF_SPEECH, vocabularyTranslationText, vocabularyTranslationGroups } from './vocabularyTranslationCounts.ts';
import { googleTranslationSelection, type GoogleTranslationSelection } from './googleTranslationSelection.ts';
import type { DictionaryMeaning } from './dictionaryEntries.ts';

export function dictionarySources(value: unknown): DictionarySourceReference[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, DictionarySourceReference>();
  for (const entry of value.slice(-64)) {
    const source = dictionarySource(entry);
    if (source) unique.set(`${source.provider}:${source.word}:${source.sourceUrl}`, source);
  }
  return [...unique.values()].slice(-8);
}

function appendMeanings(word: EnglishReviewWordEntry, meanings: readonly DictionaryMeaning[]): void {
  const tags = VOCABULARY_PARTS_OF_SPEECH.filter(([field]) => word[field] === true).map(([, label]) => label);
  const groups = vocabularyTranslationGroups(String(word.translation ?? ''), tags, normalizedVocabularyTranslations(word.translationsByPartOfSpeech));
  for (const meaning of meanings) {
    const values = (groups[meaning.partOfSpeech] ?? []).filter(value => value.trim());
    if (!values.some(value => value.trim() === meaning.text)) values.push(meaning.text);
    groups[meaning.partOfSpeech] = values;
    if (meaning.partOfSpeech !== 'unclassified') word[meaning.partOfSpeech] = true;
  }
  word.translationsByPartOfSpeech = groups;
  word.translation = vocabularyTranslationText(groups);
}

/** Confirmation appends selected senses per occurrence; never replaces manual meanings or GSAT Level. */
export function applyDictionarySelection(word: EnglishReviewWordEntry, selection: DictionaryLookupResult): boolean {
  const result = dictionaryResult(selection, String(word.text ?? ''));
  if (!result || word.fixedCombination || word.beautifulSentences) return false;
  const before = JSON.stringify(word);
  appendMeanings(word, result.meanings);
  const source = { provider: result.provider, word: result.word, sourceUrl: result.sourceUrl };
  word.dictionarySources = dictionarySources([...dictionarySources(word.dictionarySources), source]);
  return JSON.stringify(word) !== before;
}

export function applyGoogleTranslationSelection(word: EnglishReviewWordEntry, selection: GoogleTranslationSelection): boolean {
  let kind: '單字' | '組合' | '句子' = '單字';
  if (word.beautifulSentences) kind = '句子';
  else if (word.fixedCombination) kind = '組合';
  const result = googleTranslationSelection(selection, String(word.text ?? ''), kind);
  if (!result) return false;
  const before = JSON.stringify(word);
  if (kind === '單字') appendMeanings(word, [{ partOfSpeech: result.partOfSpeech, text: result.text }]);
  else {
    const existing = String(word.translation ?? '').trim();
    if (!`\n${existing.replace(/\r\n/g, '\n')}\n`.includes(`\n${result.text.replace(/\r\n/g, '\n')}\n`)) {
      word.translation = [existing, result.text].filter(Boolean).join('\n');
      const groups = normalizedVocabularyTranslations(word.translationsByPartOfSpeech) ?? {};
      groups.unclassified = [...new Set([...(groups.unclassified ?? []), result.text])];
      word.translationsByPartOfSpeech = groups;
    }
  }
  word.dictionarySources = dictionarySources([...dictionarySources(word.dictionarySources), {
    provider: 'google', word: result.word, sourceUrl: 'https://translate.google.com/',
  }]);
  return JSON.stringify(word) !== before;
}
