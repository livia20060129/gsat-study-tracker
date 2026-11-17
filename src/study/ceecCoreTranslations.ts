import { CEEC_PART_FIELDS, ceecWordIndex } from './ceecReferenceIndex.ts';
import type { VocabularyTranslations } from '../types.ts';

export function createCeecCoreLookup(loadRows: () => Promise<{ CEEC_MEANING_ROWS: string }>): {
  find(word: string): VocabularyTranslations | null;
  load(): Promise<void>;
} {
  let rows: string | undefined, offsets: number[] | undefined, pending: Promise<void> | undefined;
  const cache = new Map<number, VocabularyTranslations>();

  /** Keep the offline core as text; decode only the requested word, never all meaning objects at startup. */
  function find(word: string): VocabularyTranslations | null {
    if (rows === undefined) return null;
    const index = ceecWordIndex(word);
    if (index === undefined) return null;
    let result = cache.get(index);
    if (!result) {
      if (!offsets) {
        offsets = [0];
        for (let next = rows.indexOf('\n'); next >= 0; next = rows.indexOf('\n', next + 1)) offsets.push(next + 1);
      }
      const end = (offsets[index + 1] ?? rows.length + 1) - 1;
      const meanings = JSON.parse(rows.slice(offsets[index], end)) as Array<[number, string[]]>;
      if (!meanings.length) return null;
      result = Object.fromEntries(meanings.map(([part, values]) => [CEEC_PART_FIELDS[part], values])) as VocabularyTranslations;
      cache.set(index, result);
      if (cache.size > 256) cache.delete(cache.keys().next().value!);
    }
    return Object.fromEntries(Object.entries(result).map(([part, meanings]) => [part, [...meanings!]])) as VocabularyTranslations;
  }
  return {
    find,
    load() {
      if (rows !== undefined) return Promise.resolve();
      pending ??= loadRows().then(data => {
        if (typeof data.CEEC_MEANING_ROWS !== 'string') throw new Error('Invalid offline dictionary');
        rows = data.CEEC_MEANING_ROWS;
      }).finally(() => { pending = undefined; });
      return pending;
    },
  };
}

let browserLoadAttempts = 0;
const core = createCeecCoreLookup(async () => {
  if (typeof window === 'undefined') return import('../data/ceecCompactTranslations.ts');
  // Fetching data can retry a failed download without retaining a failed browser module entry.
  const response = await fetch(new URL('../data/ceecCoreMeanings.json', import.meta.url),
    { cache: browserLoadAttempts++ ? 'reload' : 'force-cache' });
  if (!response.ok) throw new Error('Offline dictionary unavailable');
  return response.json();
});
export const ceecCoreTranslations = core.find;
export const loadCeecCoreTranslations = core.load;
