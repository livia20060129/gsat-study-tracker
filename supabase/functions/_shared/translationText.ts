export const TRANSLATION_MAX_WORDS = 200;
export const TRANSLATION_MAX_CHARACTERS = 1000;

export interface TranslationText {
  text: string;
  words: number;
}

/** Preserve sentence context; contractions and hyphenated compounds count as one word. */
export function translationText(value: unknown): TranslationText | null {
  if (typeof value !== 'string' || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return null;
  const text = value.normalize('NFKC').trim().replace(/’/g, "'").replace(/\s+/g, ' ');
  if (!text || text.length > TRANSLATION_MAX_CHARACTERS
    || /[^\p{Script=Latin}\p{M}\p{N}\p{P}\p{Zs}+$=~^|]/u.test(text)) return null;
  const tokens = text.match(/[\p{Script=Latin}\p{M}\p{N}]+(?:['\-‐‑][\p{Script=Latin}\p{M}\p{N}]+)*/gu) ?? [];
  const words = tokens.filter(token => /\p{Script=Latin}/u.test(token)).length;
  return words > 0 && words <= TRANSLATION_MAX_WORDS ? { text, words } : null;
}
