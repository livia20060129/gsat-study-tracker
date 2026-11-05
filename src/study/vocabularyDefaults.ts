import type { VocabularyTranslations } from '../types.ts';
import { dictionaryQuery } from './dictionaryEntries.ts';
import { loadEcdictTranslations } from './ecdictLookup.ts';

export type VocabularyDefaultSource = 'ECDICT' | 'Google Translate';
export interface VocabularyDefaults { translations: VocabularyTranslations; source: VocabularyDefaultSource }

/** A failed local dictionary download is not proof that a word is absent. */
export function createVocabularyDefaultsLoader(
  local: (value: string) => Promise<VocabularyTranslations | null>,
  translate: (word: string) => Promise<string | null>,
): (value: string) => Promise<VocabularyDefaults | null> {
  return async function load(value: string): Promise<VocabularyDefaults | null> {
    const translations = await local(value);
    if (translations && Object.values(translations).some(meanings => meanings?.some(meaning => meaning.trim()))) {
      return { translations, source: 'ECDICT' };
    }
    const word = dictionaryQuery(value);
    if (!word || !/^[a-z]+(?:['-][a-z]+)*$/i.test(word)) return null;
    const translation = await translate(word);
    return translation ? { translations: { unclassified: [translation] }, source: 'Google Translate' } : null;
  };
}

export const loadVocabularyDefaults = createVocabularyDefaultsLoader(loadEcdictTranslations,
  async function translate(word): Promise<string | null> {
    const { translateMissingWord } = await import('../infrastructure/translation/googleTranslationClient.ts');
    return translateMissingWord(word);
  });
