import { dictionaryQuery, DICTIONARY_PARTS, type DictionaryPartOfSpeech } from './dictionaryEntries.ts';
import { translationText } from '../../supabase/functions/_shared/translationText.ts';

export type GoogleTranslationContentKind = '單字' | '組合' | '句子';

export interface GoogleTranslationSelection {
  word: string;
  text: string;
  partOfSpeech: DictionaryPartOfSpeech;
  contentKind?: GoogleTranslationContentKind;
}

export function googleTranslationSelection(value: unknown, expectedWord: string, expectedKind: GoogleTranslationContentKind = '單字'): GoogleTranslationSelection | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<GoogleTranslationSelection>;
  const kind = entry.contentKind ?? '單字';
  if (kind !== expectedKind || !['單字', '組合', '句子'].includes(kind)) return null;
  const word = kind === '單字' ? dictionaryQuery(entry.word) : translationText(entry.word)?.text;
  const expected = kind === '單字' ? dictionaryQuery(expectedWord) : translationText(expectedWord)?.text;
  if (!word || !expected || word.toLowerCase() !== expected.toLowerCase()
    || (kind === '單字' && !/^[a-z]+(?:['-][a-z]+)*$/.test(word))
    || typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > 2000
    || !DICTIONARY_PARTS.includes(entry.partOfSpeech!)) return null;
  const result = { word, text: entry.text.trim(), partOfSpeech: entry.partOfSpeech! };
  if (kind === '單字') return result;
  return { ...result, partOfSpeech: 'unclassified', contentKind: kind };
}
