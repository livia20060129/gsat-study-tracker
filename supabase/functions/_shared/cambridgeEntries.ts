import { cambridgeDictionaryUrl, dictionaryQuery, dictionaryResult, type DictionaryLookupResult, type DictionaryPartOfSpeech } from './dictionaryEntries.ts';

function decodedText(value: string): string {
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, function decode(entity, code: string): string {
    if (!code.startsWith('#')) return entities[code.toLowerCase()] ?? entity;
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff) ? String.fromCodePoint(point) : '';
  }).replace(/\s+/g, ' ').trim();
}

function partOfSpeech(value: string): DictionaryPartOfSpeech {
  const text = value.toLowerCase().trim();
  if (/\b(?:modal|auxiliary) verb$/.test(text)) return 'auxiliary';
  for (const part of ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'article'] as const) {
    if (text === part || text.endsWith(` ${part}`)) return part;
  }
  return 'unclassified';
}

interface HtmlFrame {
  name: string;
  capture: 'pos' | 'translation' | null;
  text: string;
  ignored: boolean;
  boundary: boolean;
  previousPart: DictionaryPartOfSpeech;
}

/** Extract plain translation spans from licensed API HTML; never execute or forward markup. */
export function cambridgeApiResult(payload: unknown, word: string): DictionaryLookupResult | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.entryContent !== 'string' || body.entryContent.length > 800_000 || typeof body.entryLabel !== 'string') return null;
  const label = decodedText(body.entryLabel.replace(/<[^>]*>/g, ''));
  if (dictionaryQuery(label) !== dictionaryQuery(word)) return null;
  const result: DictionaryLookupResult = { provider: 'cambridge', word,
    sourceUrl: cambridgeDictionaryUrl(word), meanings: [] };
  const stack: HtmlFrame[] = [];
  let currentPart: DictionaryPartOfSpeech = 'unclassified';
  function finish(frame: HtmlFrame): void {
    const text = decodedText(frame.text);
    if (!frame.ignored && frame.capture === 'pos') currentPart = partOfSpeech(text);
    if (!frame.ignored && frame.capture === 'translation' && /\p{Script=Han}/u.test(text) && text.length <= 240) {
      if (result.meanings.length < 40 && !result.meanings.some(meaning => meaning.partOfSpeech === currentPart && meaning.text === text)) {
        result.meanings.push({ partOfSpeech: currentPart, text });
      }
    }
    if (frame.boundary) currentPart = frame.previousPart;
  }
  const html = body.entryContent.replace(/<!--[\s\S]*?-->/g, '');
  for (const token of html.matchAll(/<(?:[^"'<>]|"[^"]*"|'[^']*')*>|[^<]+/g)) {
    const value = token[0];
    if (!value.startsWith('<')) {
      if (!stack.some(frame => frame.ignored)) for (const frame of stack) if (frame.capture) frame.text += value;
      continue;
    }
    const tag = value.match(/^<\s*(\/?)\s*([a-z][\w:-]*)/i);
    if (!tag) continue;
    const name = tag[2].toLowerCase();
    if (tag[1]) {
      const index = stack.map(frame => frame.name).lastIndexOf(name);
      if (index >= 0) while (stack.length > index) finish(stack.pop()!);
      continue;
    }
    const classes = (value.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find(Boolean) ?? '').split(/\s+/);
    const ignored = stack.some(frame => frame.ignored) || ['script', 'style', 'noscript', 'svg'].includes(name)
      || classes.some(item => ['examp', 'dexamp', 'example', 'eg', 'phrase-block', 'idiom-block'].includes(item));
    const boundary = name === 'entry' || classes.includes('entry-body__el');
    const frame: HtmlFrame = { name, ignored, boundary, previousPart: currentPart, text: '', capture: null };
    if (boundary) currentPart = 'unclassified';
    if (name === 'pos' || classes.includes('pos')) frame.capture = 'pos';
    if (name === 'trans' || name === 'translation' || classes.includes('trans')) frame.capture = 'translation';
    if (/\/\s*>$/.test(value) || ['br', 'img', 'input', 'hr', 'meta', 'link'].includes(name)) finish(frame);
    else {
      if (stack.length >= 80) return null;
      stack.push(frame);
    }
  }
  while (stack.length) finish(stack.pop()!);
  return dictionaryResult(result, word);
}
