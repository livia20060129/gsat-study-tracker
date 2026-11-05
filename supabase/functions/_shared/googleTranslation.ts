import { translationQuota, type TranslationQuota } from './translationQuota.ts';
import { translationText } from './translationText.ts';

interface TranslationOptions {
  env(name: string): string | undefined;
  fetch: typeof fetch;
  now?: () => number;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};

/** Signed-in accounts share an authoritative database counter across devices and function instances. */
export function createGoogleTranslationHandler(options: TranslationOptions): (request: Request) => Promise<Response> {
  const cache = new Map<string, string>();
  const usage = new Map<string, { start: number; count: number }>();
  const now = options.now ?? Date.now;
  function json(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), { status, headers: CORS });
  }
  async function quotaFor(userId: string, words: number): Promise<TranslationQuota> {
    const serviceKey = options.env('SUPABASE_SERVICE_ROLE_KEY')!;
    const body = JSON.stringify({ p_user_id: userId, p_words: words,
      p_request_id: words > 0 ? crypto.randomUUID() : null });
    // Reuse the receipt ID if an RPC reply is lost, so a transport retry cannot debit twice.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await options.fetch(`${options.env('SUPABASE_URL')}/rest/v1/rpc/google_translation_quota`, {
          method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body, signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          if (response.status >= 500 && attempt === 0) continue;
          break;
        }
        const quota = translationQuota(await response.json());
        if (quota) return quota;
        break;
      } catch { if (attempt === 0) continue; }
    }
    throw new Error('Translation quota is unavailable');
  }
  return async function translate(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
    const authorization = request.headers.get('authorization') ?? '';
    if (!/^Bearer \S+$/i.test(authorization)) return json({ error: 'Sign in required' }, 401);
    const key = options.env('GOOGLE_TRANSLATION_API_KEY');
    const supabaseUrl = options.env('SUPABASE_URL');
    const anonKey = options.env('SUPABASE_ANON_KEY');
    if (!key || !supabaseUrl || !anonKey || !options.env('SUPABASE_SERVICE_ROLE_KEY')) return json({ error: 'Translation is not configured', code: 'translation_not_configured' }, 503);
    let quota: TranslationQuota | undefined;
    try {
      const auth = await options.fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { authorization, apikey: anonKey }, signal: AbortSignal.timeout(8000),
      });
      if (!auth.ok) return json({ error: 'Invalid user session' }, 401);
      const user = await auth.json();
      if (typeof user?.id !== 'string' || user.is_anonymous === true) return json({ error: 'Registered sign-in required', code: 'translation_sign_in_required' }, 401);
      if (Number(request.headers.get('content-length') ?? 0) > 4096) return json({ error: 'Text is too long' }, 413);
      // Stream with an actual byte bound: Content-Length can be absent or untrusted.
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'Word required' }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4096) { await reader.cancel(); return json({ error: 'Text is too long' }, 413); }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let body: { word?: unknown; text?: unknown };
      try { body = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || ('word' in body && 'text' in body)) return json({ error: 'One translation input required' }, 400);
      const wholeText = 'text' in body;
      if (!wholeText && size > 1024) return json({ error: 'Word is too long' }, 413);
      const input = wholeText ? translationText(body.text) : null;
      let word = input?.text ?? '';
      if (!wholeText && typeof body.word === 'string') word = body.word.normalize('NFKC').trim().toLowerCase();
      if (wholeText ? !input : word.length > 80 || !/^[a-z]+(?:['’-][a-z]+)*$/.test(word)) {
        return json({ error: 'Valid English required (up to 200 words and 1000 characters)', code: 'translation_invalid_text' }, 400);
      }
      const wordCount = input?.words ?? 1;
      const identity = wholeText ? { text: word, wordCount } : { word };
      const cached = cache.get(word);
      if (cached) return json({ provider: 'google', ...identity, translation: cached, cached: true });
      const current = now();
      for (const [id, window] of usage) if (current - window.start >= 60_000) usage.delete(id);
      const window = usage.get(user.id) ?? { start: current, count: 0 };
      if (window.count >= 20) return json({ error: 'Please retry in a minute', code: 'translation_rate_limited' }, 429);
      window.count += 1;
      usage.set(user.id, window);
      try { quota = await quotaFor(user.id, wordCount); }
      catch { return json({ error: 'Translation quota is unavailable', code: 'translation_quota_unavailable' }, 503); }
      if (!quota.allowed) return json({ error: 'Monthly translation limit reached', code: 'translation_monthly_limit', quota }, 429);
      const response = await options.fetch('https://translation.googleapis.com/language/translate/v2', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
        body: JSON.stringify({ q: word, source: 'en', target: 'zh-TW', format: 'text' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return json({ error: 'Google Translate is temporarily unavailable', quota }, 502);
      const payload = await response.json();
      const translated = payload?.data?.translations?.[0]?.translatedText;
      if (typeof translated !== 'string' || !translated.trim() || translated.length > 2000) return json({ error: 'Invalid translation response', quota }, 502);
      const translation = translated.trim();
      cache.set(word, translation);
      if (cache.size > 256) cache.delete(cache.keys().next().value!);
      return json({ provider: 'google', ...identity, translation, cached: false, quota });
    } catch {
      // Do not return upstream responses, request tokens, words or credentials in errors.
      return json({ error: 'Translation is temporarily unavailable', ...(quota ? { quota } : {}) }, 502);
    }
  };
}
