import { dictionaryQuery } from './dictionaryEntries.ts';
import { cambridgeApiResult } from './cambridgeEntries.ts';

interface DictionaryServiceOptions {
  supabaseUrl: string;
  publishableKey: string;
  apiKey: string;
  dictionaryCode: string;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

const ORIGINS = new Set(['https://myself.liviayeh.dev', 'https://livia20060129.github.io', 'https://gsat-study-tracker.a8744895.workers.dev']);

function allowedOrigin(value: string | null): boolean {
  if (!value || ORIGINS.has(value)) return true;
  return /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(value);
}

async function limitedText(response: Response | Request, limit: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let length = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      length += value.byteLength;
      if (length > limit) throw new Error('Body too large');
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Fixed upstream, authenticated users, bounded requests and transient per-instance rate limits. */
export function createDictionaryLookupHandler(options: DictionaryServiceOptions): (request: Request) => Promise<Response> {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const limits = new Map<string, { expires: number; count: number }>();
  return async function dictionaryLookup(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' });
    if (allowedOrigin(origin)) headers.set('Access-Control-Allow-Origin', origin ?? '*');
    function json(body: unknown, status = 200): Response {
      return new Response(JSON.stringify(body), { status, headers });
    }
    function error(code: string, status: number): Response { return json({ ok: false, code }, status); }
    if (!allowedOrigin(origin)) return error('origin_not_allowed', 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ ok: false, code: 'method_not_allowed', message: 'POST required' }, 405);
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return error('invalid_request', 415);
    const bearer = request.headers.get('Authorization') ?? '';
    if (bearer.length > 8192 || !/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(bearer)) return error('auth_required', 401);
    let word: string | null;
    try {
      const body = JSON.parse(await limitedText(request, 2048));
      word = dictionaryQuery(body?.word);
    } catch { return error('invalid_request', 400); }
    if (!word) return error('invalid_request', 400);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
    try {
      if (!options.supabaseUrl || !options.publishableKey) return error('not_configured', 503);
      const auth = await fetcher(`${options.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        method: 'GET', signal: controller.signal, redirect: 'error', cache: 'no-store',
        headers: { apikey: options.publishableKey, Authorization: bearer },
      });
      if (!auth.ok) return error('auth_required', 401);
      const user = JSON.parse(await limitedText(auth, 32_768)) as { id?: unknown; is_anonymous?: unknown };
      if (typeof user.id !== 'string' || !/^[\da-f-]{36}$/i.test(user.id) || user.is_anonymous === true) return error('auth_required', 401);
      if (!options.apiKey || !/^[a-z0-9_-]{1,80}$/i.test(options.dictionaryCode)) return error('not_configured', 503);
      const time = now();
      for (const [key, value] of limits) if (value.expires <= time) limits.delete(key);
      const window = limits.get(user.id) ?? { expires: time + 60_000, count: 0 };
      if (window.count >= 6 || (!limits.has(user.id) && limits.size >= 1000)) {
        headers.set('Retry-After', '60');
        return error('rate_limited', 429);
      }
      window.count += 1;
      limits.set(user.id, window);
      const url = new URL(`https://dictionary.cambridge.org/api/v1/dictionaries/${encodeURIComponent(options.dictionaryCode)}/search/first`);
      url.searchParams.set('q', word);
      url.searchParams.set('format', 'html');
      const upstream = await fetcher(url, { method: 'GET', signal: controller.signal, redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json', accessKey: options.apiKey } });
      if (upstream.status === 404) return error('not_found', 404);
      if (upstream.status === 429) return error('rate_limited', 429);
      if (!upstream.ok) return error('upstream_unavailable', 502);
      if (!upstream.headers.get('Content-Type')?.toLowerCase().includes('application/json')) return error('invalid_response', 502);
      const payload = JSON.parse(await limitedText(upstream, 1_000_000));
      const result = cambridgeApiResult(payload, word);
      return result ? json({ ok: true, result }) : error('not_found', 404);
    } catch {
      return error('upstream_unavailable', 502);
    } finally {
      clearTimeout(timeout);
    }
  };
}
