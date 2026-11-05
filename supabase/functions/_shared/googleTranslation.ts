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

/** Personal-use translation proxy: verified account allowlist, bounded words, no public Google key. */
export function createGoogleTranslationHandler(options: TranslationOptions): (request: Request) => Promise<Response> {
  const cache = new Map<string, string>();
  const usage = new Map<string, { start: number; count: number }>();
  const now = options.now ?? Date.now;
  function json(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), { status, headers: CORS });
  }
  return async function translate(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
    const authorization = request.headers.get('authorization') ?? '';
    if (!/^Bearer \S+$/i.test(authorization)) return json({ error: 'Sign in required' }, 401);
    const key = options.env('GOOGLE_TRANSLATION_API_KEY');
    const allowedUsers = (options.env('GOOGLE_TRANSLATION_ALLOWED_USER_IDS') ?? '').split(',').map(id => id.trim()).filter(Boolean);
    const supabaseUrl = options.env('SUPABASE_URL');
    const anonKey = options.env('SUPABASE_ANON_KEY');
    if (!key || !allowedUsers.length || !supabaseUrl || !anonKey) return json({ error: 'Translation is not configured', code: 'translation_not_configured' }, 503);
    try {
      const auth = await options.fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { authorization, apikey: anonKey }, signal: AbortSignal.timeout(8000),
      });
      if (!auth.ok) return json({ error: 'Invalid user session' }, 401);
      const user = await auth.json();
      if (typeof user.id !== 'string' || !allowedUsers.includes(user.id)) return json({ error: 'Account is not allowed' }, 403);
      if (Number(request.headers.get('content-length') ?? 0) > 1024) return json({ error: 'Word is too long' }, 413);
      // Stream with an actual byte bound: Content-Length can be absent or untrusted.
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'Word required' }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1024) { await reader.cancel(); return json({ error: 'Word is too long' }, 413); }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let body: { word?: unknown };
      try { body = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { return json({ error: 'Invalid JSON' }, 400); }
      const word = typeof body?.word === 'string' ? body.word.normalize('NFKC').trim().toLowerCase() : '';
      if (word.length > 80 || !/^[a-z]+(?:['’-][a-z]+)*$/.test(word)) return json({ error: 'One English word required' }, 400);
      const cached = cache.get(word);
      if (cached) return json({ provider: 'google', word, translation: cached });
      const current = now();
      for (const [id, window] of usage) if (current - window.start >= 60_000) usage.delete(id);
      const window = usage.get(user.id) ?? { start: current, count: 0 };
      if (window.count >= 20) return json({ error: 'Please retry in a minute', code: 'translation_rate_limited' }, 429);
      window.count += 1;
      usage.set(user.id, window);
      const response = await options.fetch('https://translation.googleapis.com/language/translate/v2', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
        body: JSON.stringify({ q: word, source: 'en', target: 'zh-TW', format: 'text' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return json({ error: 'Google Translate is temporarily unavailable' }, 502);
      const payload = await response.json();
      const translated = payload?.data?.translations?.[0]?.translatedText;
      if (typeof translated !== 'string' || !translated.trim() || translated.length > 2000) return json({ error: 'Invalid translation response' }, 502);
      const translation = translated.trim();
      cache.set(word, translation);
      if (cache.size > 256) cache.delete(cache.keys().next().value!);
      return json({ provider: 'google', word, translation });
    } catch {
      // Do not return upstream responses, request tokens, words or credentials in errors.
      return json({ error: 'Translation is temporarily unavailable' }, 502);
    }
  };
}
