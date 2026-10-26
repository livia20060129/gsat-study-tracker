/** Public wire contract shared with the deployable function; this module contains no backend credentials. */
export {
  DICTIONARY_PARTS, ECDICT_SOURCE_URL, cambridgeDictionaryUrl, dictionaryQuery, dictionaryResult, dictionarySource,
  type DictionaryLookupResult, type DictionaryMeaning, type DictionaryPartOfSpeech,
  type DictionaryProvider, type DictionarySourceReference,
} from '../../supabase/functions/_shared/dictionaryEntries.ts';
