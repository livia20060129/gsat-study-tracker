import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../config/supabase.ts';
import { browserAuthPersistence, createPersistentAuthStorage } from '../storage/browserAuthStorage.ts';
import { initialRecordPrefix, storagePrefixForUser } from '../../storage/local.ts';
import { translationQuota } from '../../../supabase/functions/_shared/translationQuota.ts';
import { translationText } from '../../../supabase/functions/_shared/translationText.ts';

const pending = new Map<string, Promise<string | null>>();
const cache = new Map<string, string>();

/** Reads the existing persisted login; it cannot create a guest session or change account scope. */
export async function translateMissingWord(word: string): Promise<string | null> {
  if (!/^[a-z]+(?:['’-][a-z]+)*$/i.test(word) || word.length > 80) return null;
  return requestGoogleTranslation(word.normalize('NFKC').trim().toLowerCase(), 'word');
}

/** Whole-text translation is available only through an explicit preview request. */
export async function translateGoogleText(value: string): Promise<string | null> {
  const input = translationText(value);
  return input ? requestGoogleTranslation(input.text, 'text') : null;
}

async function requestGoogleTranslation(word: string, field: 'word' | 'text'): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const prefix = initialRecordPrefix(localStorage);
  if (!prefix.startsWith('study-v11:user:')) return null;
  const auth = createPersistentAuthStorage(browserAuthPersistence(window.indexedDB), localStorage);
  const authKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const raw = await auth.getItem(authKey);
  if (!raw) return null;
  const session = JSON.parse(raw) as { access_token?: string; user?: { id?: string } };
  if (!session.access_token || !session.user?.id || storagePrefixForUser(session.user.id) !== prefix) return null;
  const key = `${prefix}${word}`;
  if (cache.has(key)) return cache.get(key)!;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async function requestTranslation(): Promise<string | null> {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/google-translation`, {
      method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: word }), signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    if (initialRecordPrefix(localStorage) !== prefix) return null;
    if (!response.ok) {
      const quota = translationQuota(result.quota);
      if (result.code === 'translation_monthly_limit' && quota) {
        const reset = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' }).format(new Date(quota.resetsAt));
        throw new Error(`Google Translate 本月額度不足：已使用 ${quota.used.toLocaleString('en-US')}／5,000 個單字，剩餘 ${quota.remaining} 個單字；${reset} 台北時間 00:00 重置。英文已保存，可手動填寫中文。`);
      }
      if (result.code === 'translation_quota_unavailable') throw new Error('Google Translate 暫時無法確認本月額度；英文已保存，請稍後重試或手動填寫中文。');
      if (response.status === 401) throw new Error('Google Translate 需要有效登入；英文已保存，請回 Tracker 確認登入後重試。');
      if (result.code === 'translation_rate_limited') throw new Error('Google Translate 查詢過於頻繁；英文已保存，請稍後重試。');
      if (result.code === 'translation_invalid_text') throw new Error('Google Translate 每次支援最多 200 個英文單字、1,000 個字元；請縮短內容或手動填寫中文。');
      if (response.status === 503) throw new Error('Google Translate 尚未設定；英文已保存，可手動填寫中文。');
      throw new Error(`Google Translate 暫時無法使用${quota ? `（本月剩餘 ${quota.remaining} 個單字；已送出的單字已計入額度）` : ''}；英文已保存，可稍後重試或手動填寫中文。`);
    }
    if (result.provider !== 'google' || result[field] !== word) return null;
    if (typeof result.translation !== 'string' || !result.translation.trim()) throw new Error('Google Translate 未回傳有效翻譯。');
    cache.set(key, result.translation);
    if (cache.size > 256) cache.delete(cache.keys().next().value!);
    return result.translation;
  })();
  pending.set(key, task);
  try { return await task; }
  catch (error) {
    if (initialRecordPrefix(localStorage) !== prefix) return null;
    if (error instanceof Error && error.message.includes('Google Translate')) throw error;
    throw new Error('Google Translate 暫時無法連線；英文已保存，可稍後重試或手動填寫中文。');
  }
  finally { if (pending.get(key) === task) pending.delete(key); }
}
