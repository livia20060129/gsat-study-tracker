import { dictionaryQuery, DICTIONARY_PARTS, type DictionaryPartOfSpeech } from './dictionaryEntries.ts';

export interface GoogleTranslationSelection {
  word: string;
  text: string;
  partOfSpeech: DictionaryPartOfSpeech;
}

export function googleTranslationSelection(value: unknown, expectedWord: string): GoogleTranslationSelection | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<GoogleTranslationSelection>;
  const word = dictionaryQuery(entry.word);
  if (!word || word !== dictionaryQuery(expectedWord) || !/^[a-z]+(?:['-][a-z]+)*$/.test(word)
    || typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 2000
    || !DICTIONARY_PARTS.includes(entry.partOfSpeech!)) return null;
  return { word, text: entry.text.trim(), partOfSpeech: entry.partOfSpeech! };
}
