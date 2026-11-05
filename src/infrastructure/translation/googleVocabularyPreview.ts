import { dictionaryQuery, type DictionaryPartOfSpeech } from '../../study/dictionaryEntries.ts';
import { loadVocabularyFallbackParts } from '../../study/vocabularyFallbackParts.ts';
import { VOCABULARY_PARTS_OF_SPEECH } from '../../study/vocabularyTranslationCounts.ts';
import type { GoogleTranslationSelection } from '../../study/googleTranslationSelection.ts';
import { translateMissingWord } from './googleTranslationClient.ts';

/** An explicit click may request Google even when ECDICT already has a translation. */
export async function loadGoogleVocabularyPreview(value: string, tags: readonly string[]): Promise<GoogleTranslationSelection | null> {
  const word = dictionaryQuery(value);
  if (!word || !/^[a-z]+(?:['-][a-z]+)*$/.test(word)) return null;
  const text = await translateMissingWord(word);
  if (!text) return null;
  const reference = await loadVocabularyFallbackParts(word);
  let partOfSpeech: DictionaryPartOfSpeech = 'unclassified';
  if (tags.length === 1) partOfSpeech = VOCABULARY_PARTS_OF_SPEECH.find(([, label]) => label === tags[0])?.[0] ?? 'unclassified';
  else if (tags.length === 0 && reference?.parts.length === 1) partOfSpeech = reference.parts[0];
  return { word, text, partOfSpeech };
}
