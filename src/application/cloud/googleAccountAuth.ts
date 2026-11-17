import { requestedStudyDate } from '../../ui/siteNavigation.ts';

export const GOOGLE_AUTH_INTENT_KEY = 'study-v11:auth:google-intent';
const INTENT_MAX_AGE = 20 * 60 * 1000;
export class GoogleAuthDraftError extends Error {
  constructor(reason = '請先按「儲存」查看原因，再重新登入。') {
    super('登入前的讀書紀錄尚未保存。' + reason);
    this.name = 'GoogleAuthDraftError';
  }
}
export interface GoogleAuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export interface GoogleAuthUser {
  id: string;
  identities?: { provider: string }[];
  app_metadata?: { provider?: string; providers?: string[] };
}
export interface GoogleAuthIntent {
  version: 1;
  attempt: string;
  kind: 'signin' | 'link';
  userId: string | null;
  date: string;
  startedAt: number;
}
export interface GoogleAuthReturn {
  requested: boolean;
  intent: GoogleAuthIntent | null;
  error: string | null;
  allowExchange: boolean;
}

export function hasGoogleIdentity(user: GoogleAuthUser | null): boolean {
  return Boolean(user?.identities?.some(identity => identity.provider === 'google')
    || user?.app_metadata?.providers?.includes('google') || user?.app_metadata?.provider === 'google');
}

/** Fixed same-origin callback; the chosen date stays in the durable intent. */
export function googleAuthReturnUrl(href: string): string {
  const url = new URL('./index.html', href);
  url.search = '?google_auth=1';
  url.hash = '';
  return url.href;
}

export function parseGoogleAuthIntent(raw: string | null, now: number): GoogleAuthIntent | null {
  if (!raw) return null;
  try {
    const intent: GoogleAuthIntent = JSON.parse(raw);
    if (intent.version !== 1 || !['signin', 'link'].includes(intent.kind)
      || typeof intent.attempt !== 'string' || !intent.attempt || intent.attempt.length > 100
      || !Number.isFinite(intent.startedAt) || now - intent.startedAt < 0 || now - intent.startedAt > INTENT_MAX_AGE
      || requestedStudyDate(`?date=${encodeURIComponent(intent.date)}`) !== intent.date
      || (intent.kind === 'link' ? typeof intent.userId !== 'string' || !intent.userId : intent.userId !== null)) return null;
    return intent;
  } catch { return null; }
}

/** Error codes only: provider descriptions may contain URLs or private data. */
export function googleAuthErrorMessage(error: unknown): string {
  if (error instanceof GoogleAuthDraftError) return error.message;
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'identity_already_exists' || code === 'identity_already_linked') return '這個 Google 帳號已綁定其他帳號，請使用原先綁定的帳號登入。';
  if (code === 'manual_linking_disabled') return '尚未啟用帳號綁定，請依設定說明開啟 Supabase 的 Manual Linking。';
  if (code === 'provider_disabled' || code === 'validation_failed') return 'Google 登入尚未完成設定，請依設定說明啟用 Supabase 的 Google 登入。';
  if (code === 'access_denied') return '已取消 Google 授權，原有紀錄仍保留。';
  if (code === 'google_identity_mismatch') return '回傳帳號與原帳號不同，已停止綁定；原有紀錄仍保留。';
  if (code === 'google_auth_expired') return '登入連結已過期或缺少驗證資料，請重新使用 Google 登入。';
  if (code === 'google_auth_replaced') return '另一個分頁已開始新的 Google 登入，請在最新操作的分頁繼續。';
  if (code === 'device_backup_unavailable') return '紀錄已保存在本機，但登入前的裝置備份未完成；請開啟「安裝與資料」檢查儲存空間後再試。';
  if (error instanceof Error && /storage|儲存|保存/i.test(error.message)) return '無法保存登入驗證資料，請確認瀏覽器允許此網站使用儲存空間後再試。';
  return 'Google 登入或綁定未完成，請確認網路與登入設定後再試；原有紀錄仍保留。';
}

export async function prepareGoogleAuthReturn(href: string, storage: GoogleAuthStorage, now = Date.now()): Promise<GoogleAuthReturn> {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.get('google_auth') !== '1') {
    // Retired email/recovery links must never replace the current account session.
    if (url.searchParams.has('code') || hash.has('access_token') || hash.has('refresh_token') || hash.get('type') === 'recovery') {
      return { requested: true, intent: null, error: '此登入連結已停用，請重新使用 Google 登入；原有紀錄仍保留。', allowExchange: false };
    }
    return { requested: false, intent: null, error: null, allowExchange: true };
  }
  const code = url.searchParams.get('error_code') || hash.get('error_code') || url.searchParams.get('error') || hash.get('error');
  let intent: GoogleAuthIntent | null;
  try { intent = parseGoogleAuthIntent(await storage.getItem(GOOGLE_AUTH_INTENT_KEY), now); }
  catch (error) { return { requested: true, intent: null, error: googleAuthErrorMessage(error), allowExchange: false }; }
  if (code) return { requested: true, intent, error: googleAuthErrorMessage({ code }), allowExchange: false };
  if (!intent || !url.searchParams.get('code')) return { requested: true, intent, error: googleAuthErrorMessage({ code: 'google_auth_expired' }), allowExchange: false };
  return { requested: true, intent, error: null, allowExchange: true };
}

export async function clearGoogleAuthIntent(storage: GoogleAuthStorage, attempt: string): Promise<void> {
  const raw = await storage.getItem(GOOGLE_AUTH_INTENT_KEY);
  if (!raw) return;
  try { if (JSON.parse(raw).attempt === attempt) await storage.removeItem(GOOGLE_AUTH_INTENT_KEY); }
  catch { /* An unrelated or malformed intent must not be deleted. */ }
}

interface OAuthOptions {
  provider: 'google';
  options: { redirectTo: string; scopes: string; queryParams: { prompt: string }; skipBrowserRedirect: true };
}
interface OAuthResult { data: { url: string | null }; error: unknown }
export interface GoogleOAuthApi {
  signInWithOAuth(options: OAuthOptions): Promise<OAuthResult>;
  linkIdentity(options: OAuthOptions): Promise<OAuthResult>;
  getUser(): Promise<{ data: { user: GoogleAuthUser | null }; error: unknown }>;
}

export async function beginGoogleAuthentication(options: {
  auth: GoogleOAuthApi; storage: GoogleAuthStorage; supabaseUrl: string; href: string;
  date: string; userId: string | null; currentUserId(): string | null; saveDraft(): boolean;
  redirect(url: string): void; now?: number; attempt?: string;
  beforeRedirect?(): Promise<void>;
}): Promise<void> {
  const intent: GoogleAuthIntent = { version: 1, kind: options.userId ? 'link' : 'signin', userId: options.userId,
    date: options.date, startedAt: options.now ?? Date.now(), attempt: options.attempt ?? crypto.randomUUID() };
  if (!parseGoogleAuthIntent(JSON.stringify(intent), intent.startedAt)) throw new Error('Invalid Google authentication context');
  if (!options.saveDraft()) throw new GoogleAuthDraftError();
  if (intent.kind === 'link') {
    const result = await options.auth.getUser();
    if (result.error) throw result.error;
    if (result.data.user?.id !== intent.userId) throw { code: 'google_identity_mismatch' };
  }
  await options.storage.setItem(GOOGLE_AUTH_INTENT_KEY, JSON.stringify(intent));
  try {
    const request: OAuthOptions = { provider: 'google', options: { redirectTo: googleAuthReturnUrl(options.href),
      scopes: 'openid email profile', queryParams: { prompt: 'select_account' }, skipBrowserRedirect: true } };
    const result = intent.kind === 'link' ? await options.auth.linkIdentity(request) : await options.auth.signInWithOAuth(request);
    if (result.error) throw result.error;
    if (!result.data.url) throw new Error('Missing Google authorization URL');
    const url = new URL(result.data.url), supabase = new URL(options.supabaseUrl);
    const valid = intent.kind === 'signin'
      ? url.origin === supabase.origin && url.pathname === '/auth/v1/authorize' && url.searchParams.get('provider') === 'google' && Boolean(url.searchParams.get('code_challenge')) && url.searchParams.get('code_challenge_method')?.toLowerCase() === 's256'
      : url.origin === 'https://accounts.google.com' && ['/o/oauth2/v2/auth', '/o/oauth2/auth'].includes(url.pathname);
    if (!valid || options.currentUserId() !== intent.userId) throw { code: 'google_identity_mismatch' };
    const current = parseGoogleAuthIntent(await options.storage.getItem(GOOGLE_AUTH_INTENT_KEY), options.now ?? Date.now());
    if (current?.attempt !== intent.attempt) throw { code: 'google_auth_replaced' };
    if (!options.saveDraft()) throw new GoogleAuthDraftError();
    if (options.beforeRedirect) {
      try { await options.beforeRedirect(); } catch { throw { code: 'device_backup_unavailable' }; }
      if (options.currentUserId() !== intent.userId) throw { code: 'google_identity_mismatch' };
      const prepared = parseGoogleAuthIntent(await options.storage.getItem(GOOGLE_AUTH_INTENT_KEY), options.now ?? Date.now());
      if (prepared?.attempt !== intent.attempt) throw { code: 'google_auth_replaced' };
    }
    if (intent.kind === 'signin') url.searchParams.delete('skip_http_redirect');
    options.redirect(url.href);
  } catch (error) {
    await clearGoogleAuthIntent(options.storage, intent.attempt).catch(() => {});
    throw error;
  }
}

/** Check a linked callback BEFORE the SDK can persist or broadcast a new user. */
export function googleAuthFetch(base: typeof fetch, supabaseUrl: string, plan: GoogleAuthReturn): typeof fetch {
  const origin = new URL(supabaseUrl).origin;
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const pkce = url.origin === origin && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce';
    const linking = url.origin === origin && url.pathname === '/auth/v1/user/identities/authorize';
    if (!pkce && !linking) return base(input, init);
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    const signal = init?.signal;
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 12_000);
    try {
      const response = await base(input, { ...init, signal: controller.signal });
      if (pkce && response.ok && plan.intent?.kind === 'link') {
        const data = await response.clone().json();
        if (data.user?.id !== plan.intent.userId) {
          plan.error = googleAuthErrorMessage({ code: 'google_identity_mismatch' });
          return new Response(JSON.stringify({ code: 'google_identity_mismatch', error: 'invalid_request', error_description: plan.error }), {
            status: 400, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
          });
        }
      }
      return response;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  };
}

export function cleanGoogleAuthReturnUrl(href: string, date?: string): string {
  const url = new URL(href);
  for (const key of ['google_auth', 'code', 'error', 'error_code', 'error_description']) url.searchParams.delete(key);
  if (date && requestedStudyDate(`?date=${date}`)) url.searchParams.set('date', date);
  if (/[&=]|access_token|error/.test(url.hash)) url.hash = '';
  return url.href;
}

export async function completeGoogleAuthReturn(plan: GoogleAuthReturn, storage: GoogleAuthStorage, auth: {
  initialize(): Promise<{ error: unknown }>;
  getSession(): Promise<{ data: { session: { user: GoogleAuthUser } | null }; error: unknown }>;
  signOut(options: { scope: 'local' }): Promise<unknown>;
}): Promise<{ message: string; ok: boolean }> {
  try {
    if (!plan.allowExchange || !plan.intent) return { message: plan.error ?? googleAuthErrorMessage({ code: 'google_auth_expired' }), ok: false };
    const initialized = await auth.initialize();
    if (initialized.error) throw initialized.error;
    if (plan.error) return { message: plan.error, ok: false };
    const result = await auth.getSession();
    if (result.error) throw result.error;
    const user = result.data.session?.user;
    if (user && plan.intent.kind === 'link' && user.id !== plan.intent.userId) {
      await auth.signOut({ scope: 'local' });
      throw { code: 'google_identity_mismatch' };
    }
    if (!user || !hasGoogleIdentity(user)) return { message: 'Google 登入或綁定尚未完成，請重新操作；原帳號仍可使用。', ok: false };
    return { message: plan.intent.kind === 'link' ? '已綁定 Google，並沿用原帳號的紀錄與翻譯額度。' : '已使用 Google 登入。', ok: true };
  } catch (error) {
    return { message: plan.error ?? googleAuthErrorMessage(error), ok: false };
  } finally {
    if (plan.intent) await clearGoogleAuthIntent(storage, plan.intent.attempt).catch(() => {});
  }
}
