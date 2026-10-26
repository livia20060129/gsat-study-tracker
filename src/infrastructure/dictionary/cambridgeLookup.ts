import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../config/supabase.ts';
import { storagePrefixForUser } from '../../storage/local.ts';
import { dictionaryQuery, dictionaryResult, type DictionaryLookupResult } from '../../study/dictionaryEntries.ts';

let clientPromise: Promise<SupabaseClient> | null = null;

function dictionaryClient(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(function createDictionaryClient({ createClient }): SupabaseClient {
    return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  });
  return clientPromise;
}

const ERROR_MESSAGES: Record<string, string> = {
  auth_required: '請先回到 Tracker 登入 Cloud，再使用劍橋查詢。本機字典及手動輸入仍可使用。',
  not_configured: '劍橋查詢尚未設定 API 金鑰及字典代碼，可先使用本機字典或手動輸入。',
  not_found: '劍橋未回傳精確相符的繁中釋義，可開啟劍橋字典確認或手動輸入。',
  rate_limited: '查詢次數較多，請稍後再試；仍可手動輸入。',
  upstream_unavailable: '劍橋目前無法取得翻譯，請稍後再試或手動輸入。',
  invalid_response: '劍橋回傳的內容無法確認，尚未填入任何翻譯。',
};

/** Only this deliberate action sends the word to the authenticated backend. */
export async function lookupCambridge(word: string, recordPrefix: string, signal: AbortSignal): Promise<DictionaryLookupResult> {
  const query = dictionaryQuery(word);
  if (!query) throw new Error('請先輸入有效的英文單字或短語。');
  const client = await dictionaryClient();
  const sessionResult = await client.auth.getSession();
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const session = sessionResult.data.session;
  if (sessionResult.error || !session || storagePrefixForUser(session.user.id) !== recordPrefix) {
    throw new Error(ERROR_MESSAGES.auth_required);
  }
  const response = await fetch(`${SUPABASE_URL}/functions/v1/dictionary-lookup`, {
    method: 'POST', signal, cache: 'no-store', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ word: query }),
  }).catch(function failedLookup(error: unknown): never {
    if (signal.aborted) throw error;
    throw new Error(ERROR_MESSAGES.upstream_unavailable);
  });
  const body = await response.json().catch(() => null) as { code?: string; result?: unknown } | null;
  if (!response.ok) {
    if (response.status === 401) throw new Error(ERROR_MESSAGES.auth_required);
    if (response.status === 404 && !body?.code) throw new Error('劍橋查詢服務尚未部署，可先使用本機字典或手動輸入。');
    throw new Error(ERROR_MESSAGES[body?.code ?? ''] ?? ERROR_MESSAGES.upstream_unavailable);
  }
  const result = dictionaryResult(body?.result, query);
  if (!result || result.provider !== 'cambridge') throw new Error(ERROR_MESSAGES.invalid_response);
  return result;
}
