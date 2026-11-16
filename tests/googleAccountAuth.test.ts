import assert from 'node:assert/strict';
import test from 'node:test';
import { beginGoogleAuthentication, cleanGoogleAuthReturnUrl, clearGoogleAuthIntent, completeGoogleAuthReturn, GOOGLE_AUTH_INTENT_KEY,
  GoogleAuthDraftError, googleAuthErrorMessage, googleAuthFetch, googleAuthReturnUrl, hasGoogleIdentity, parseGoogleAuthIntent, prepareGoogleAuthReturn,
  type GoogleAuthIntent, type GoogleAuthStorage, type GoogleOAuthApi } from '../src/application/cloud/googleAccountAuth.ts';

const now = Date.parse('2026-11-15T12:00:00+08:00');
const origin = 'https://auth.example.test';
const userId = '00000000-0000-0000-0000-000000000180';
const linked = { id: userId, identities: [{ provider: 'email' }, { provider: 'google' }] };
const intent = (kind: 'signin' | 'link' = 'signin'): GoogleAuthIntent => ({ version: 1, attempt: 'attempt-a', kind, userId: kind === 'link' ? userId : null, date: '2026-11-14', startedAt: now });
function storage(): GoogleAuthStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, async getItem(key) { return values.get(key) ?? null; }, async setItem(key, value) { values.set(key, value); }, async removeItem(key) { values.delete(key); } };
}
function fixture(kind: 'signin' | 'link' = 'signin') {
  const store = storage(), calls: { method: string; options: unknown }[] = [], redirects: string[] = [];
  let saves = 0;
  const auth: GoogleOAuthApi = {
    async getUser() { return { data: { user: { id: userId } }, error: null }; },
    async signInWithOAuth(options) { calls.push({ method: 'signin', options }); return { data: { url: `${origin}/auth/v1/authorize?provider=google&code_challenge=challenge&code_challenge_method=s256&skip_http_redirect=true` }, error: null }; },
    async linkIdentity(options) { calls.push({ method: 'link', options }); return { data: { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed-state' }, error: null }; },
  };
  const options = { auth, storage: store, supabaseUrl: origin, href: 'https://tracker.example.test/sub/index.html?date=2026-11-14#section',
    date: '2026-11-14', userId: kind === 'link' ? userId : null, currentUserId: (): string | null => kind === 'link' ? userId : null,
    saveDraft: () => { saves++; return true; }, redirect: (url: string) => { redirects.push(url); }, now, attempt: 'attempt-a' };
  return { store, calls, redirects, auth, options, saves: () => saves };
}

test('Google callbacks stay on the current origin and project directory with a fixed allow-list URL', () => {
  assert.equal(googleAuthReturnUrl('https://tracker.example.test/sub/index.html?next=https://evil.test/#token'), 'https://tracker.example.test/sub/index.html?google_auth=1');
  assert.equal(googleAuthReturnUrl('https://tracker.example.test/'), 'https://tracker.example.test/index.html?google_auth=1');
});
test('intent validation rejects expiration, future timestamps, malformed dates, versions and missing linked users', () => {
  assert.deepEqual(parseGoogleAuthIntent(JSON.stringify(intent()), now), intent());
  for (const change of [{ startedAt: now - 1_200_001 }, { startedAt: now + 1 }, { date: '2026-02-30' }, { version: 2 }, { kind: 'other' }, { kind: 'link', userId: null }, { kind: 'signin', userId }, { attempt: '' }]) {
    assert.equal(parseGoogleAuthIntent(JSON.stringify({ ...intent(), ...change }), now), null);
  }
  assert.equal(parseGoogleAuthIntent('{bad', now), null);
});
test('Google identity status supports linked identities and server app metadata', () => {
  assert.equal(hasGoogleIdentity(linked), true);
  assert.equal(hasGoogleIdentity({ id: userId, app_metadata: { providers: ['email', 'google'] } }), true);
  assert.equal(hasGoogleIdentity({ id: userId }), false);
  assert.equal(hasGoogleIdentity(null), false);
});
test('sign-in saves both initial and late drafts, stores durable intent, and requests basic identity scopes only', async () => {
  const f = fixture();
  await beginGoogleAuthentication(f.options);
  assert.equal(f.saves(), 2);
  assert.deepEqual(f.calls, [{ method: 'signin', options: { provider: 'google', options: { redirectTo: 'https://tracker.example.test/sub/index.html?google_auth=1', scopes: 'openid email profile', queryParams: { prompt: 'select_account' }, skipBrowserRedirect: true } } }]);
  assert.deepEqual(JSON.parse(f.store.values.get(GOOGLE_AUTH_INTENT_KEY)!), intent());
  assert.equal(f.redirects.length, 1);
  assert.equal(new URL(f.redirects[0]).searchParams.has('skip_http_redirect'), false);
});
test('linking calls linkIdentity while preserving original account data and translation usage', async () => {
  const f = fixture('link');
  f.store.values.set(`study-v11:user:${userId}:2026-11-14`, 'original-record');
  f.store.values.set(`translation-usage:${userId}`, '321');
  await beginGoogleAuthentication(f.options);
  assert.equal(f.calls[0].method, 'link');
  assert.equal(JSON.parse(f.store.values.get(GOOGLE_AUTH_INTENT_KEY)!).userId, userId);
  assert.equal(f.store.values.get(`study-v11:user:${userId}:2026-11-14`), 'original-record');
  assert.equal(f.store.values.get(`translation-usage:${userId}`), '321');
});
test('a failed draft or durable intent write prevents any redirect', async () => {
  const f = fixture();
  f.options.saveDraft = () => false;
  await assert.rejects(beginGoogleAuthentication(f.options));
  assert.equal(f.calls.length, 0);
  const g = fixture();
  g.store.setItem = async () => { throw new Error('storage unavailable'); };
  await assert.rejects(beginGoogleAuthentication(g.options));
  assert.equal(g.calls.length, 0);
  assert.equal(g.redirects.length, 0);
});

test('unsaved study drafts retain their own explanation instead of claiming auth storage is blocked', async () => {
  const f = fixture();
  f.options.saveDraft = () => false;
  await assert.rejects(beginGoogleAuthentication(f.options), error => {
    assert.ok(error instanceof GoogleAuthDraftError);
    assert.match(googleAuthErrorMessage(error), /讀書紀錄尚未保存/);
    assert.doesNotMatch(googleAuthErrorMessage(error), /登入驗證資料|瀏覽器允許/);
    return true;
  });
  const validation = new GoogleAuthDraftError('起床時間格式不正確。');
  assert.match(googleAuthErrorMessage(validation), /起床時間格式不正確/);
  assert.equal(f.calls.length, 0);
});

test('a real durable auth write failure still reports auth storage and never redirects', async () => {
  const f = fixture();
  f.store.setItem = async () => { throw new Error('無法保存登入狀態，請確認瀏覽器允許此網站使用儲存空間後再試一次。'); };
  await assert.rejects(beginGoogleAuthentication(f.options), error => {
    assert.match(googleAuthErrorMessage(error), /登入驗證資料/);
    assert.doesNotMatch(googleAuthErrorMessage(error), /讀書紀錄尚未保存/);
    return true;
  });
  assert.equal(f.redirects.length, 0);
});
test('an account change while authorization is being prepared prevents a stale redirect', async () => {
  const f = fixture('link');
  f.options.currentUserId = () => 'different-account';
  await assert.rejects(beginGoogleAuthentication(f.options), error => (error as { code: string }).code === 'google_identity_mismatch');
  assert.equal(f.redirects.length, 0);
  assert.equal(f.store.values.has(GOOGLE_AUTH_INTENT_KEY), false);
});
test('linking refuses a different verified server user before calling the provider', async () => {
  const f = fixture('link');
  f.auth.getUser = async () => ({ data: { user: { id: 'other' } }, error: null });
  await assert.rejects(beginGoogleAuthentication(f.options));
  assert.equal(f.calls.length, 0);
});
test('an unsafe provider URL or non-PKCE login never redirects', async () => {
  for (const url of ['https://evil.test/auth/v1/authorize?provider=google&code_challenge=x', `${origin}/auth/v1/authorize?provider=google`, 'javascript:alert(1)']) {
    const f = fixture();
    f.auth.signInWithOAuth = async () => ({ data: { url }, error: null });
    await assert.rejects(beginGoogleAuthentication(f.options));
    assert.equal(f.redirects.length, 0);
  }
});
test('another tab replacing the intent cancels the old operation without deleting the newer intent', async () => {
  const f = fixture();
  const begin = f.auth.signInWithOAuth;
  f.auth.signInWithOAuth = async options => {
    await f.store.setItem(GOOGLE_AUTH_INTENT_KEY, JSON.stringify({ ...intent(), attempt: 'new-attempt' }));
    return begin(options);
  };
  await assert.rejects(beginGoogleAuthentication(f.options), error => (error as { code: string }).code === 'google_auth_replaced');
  assert.equal(JSON.parse(f.store.values.get(GOOGLE_AUTH_INTENT_KEY)!).attempt, 'new-attempt');
  assert.equal(f.redirects.length, 0);
});
test('a callback requires an unexpired durable intent and maps cancellation without exposing provider descriptions', async () => {
  const store = storage();
  assert.equal((await prepareGoogleAuthReturn('https://tracker.test/?google_auth=1&code=abc', store, now)).allowExchange, false);
  await store.setItem(GOOGLE_AUTH_INTENT_KEY, JSON.stringify(intent()));
  const plan = await prepareGoogleAuthReturn('https://tracker.test/?google_auth=1&code=abc', store, now);
  assert.equal(plan.allowExchange, true);
  const canceled = await prepareGoogleAuthReturn('https://tracker.test/?google_auth=1&error=access_denied&error_description=private-data', store, now);
  assert.equal(canceled.allowExchange, false);
  assert.ok(canceled.error!.includes('已取消'));
  assert.ok(!canceled.error!.includes('private-data'));
});

test('retired email callbacks are refused before reading auth storage or exchanging credentials', async () => {
  const store = storage();
  store.getItem = async () => { throw new Error('retired callbacks must not inspect stored sessions'); };
  for (const href of ['https://tracker.test/?code=retired-recovery', 'https://tracker.test/#access_token=retired&refresh_token=retired&type=recovery', 'https://tracker.test/#type=recovery']) {
    const plan = await prepareGoogleAuthReturn(href, store, now);
    assert.equal(plan.requested, true);
    assert.equal(plan.allowExchange, false);
    assert.equal(plan.intent, null);
    assert.ok(plan.error!.includes('此登入連結已停用'));
  }
});

test('ordinary navigation and Calendar returns still restore the existing account normally', async () => {
  const store = storage();
  store.getItem = async () => { throw new Error('ordinary navigation does not read a Google intent'); };
  for (const href of ['https://tracker.test/?date=2026-11-14', 'https://tracker.test/?calendar=connected#notes']) {
    assert.deepEqual(await prepareGoogleAuthReturn(href, store, now), { requested: false, intent: null, error: null, allowExchange: true });
  }
});
test('a blocked callback store produces an actionable message without enabling code exchange', async () => {
  const store = storage(); store.getItem = async () => { throw new Error('storage unavailable'); };
  const plan = await prepareGoogleAuthReturn('https://tracker.test/?google_auth=1&code=abc', store, now);
  assert.equal(plan.allowExchange, false);
  assert.ok(plan.error!.includes('儲存空間'));
});
test('callback URLs remove authentication values and retain the selected date and normal anchors', () => {
  assert.equal(cleanGoogleAuthReturnUrl('https://tracker.test/index.html?google_auth=1&code=private&error_description=secret#notes', '2026-11-14'), 'https://tracker.test/index.html?date=2026-11-14#notes');
  assert.equal(new URL(cleanGoogleAuthReturnUrl('https://tracker.test/?google_auth=1#access_token=private&refresh_token=private')).hash, '');
});
test('cleanup cannot clear a different attempt', async () => {
  const store = storage(); await store.setItem(GOOGLE_AUTH_INTENT_KEY, JSON.stringify(intent()));
  await clearGoogleAuthIntent(store, 'different-attempt');
  assert.equal(store.values.has(GOOGLE_AUTH_INTENT_KEY), true);
  await clearGoogleAuthIntent(store, 'attempt-a');
  assert.equal(store.values.has(GOOGLE_AUTH_INTENT_KEY), false);
});
test('a successful linked callback verifies the original UUID and consumes only its own intent', async () => {
  const store = storage(); await store.setItem(GOOGLE_AUTH_INTENT_KEY, JSON.stringify(intent('link')));
  let signouts = 0;
  const result = await completeGoogleAuthReturn({ requested: true, intent: intent('link'), error: null, allowExchange: true }, store, {
    async initialize() { return { error: null }; }, async getSession() { return { data: { session: { user: linked } }, error: null }; }, async signOut() { signouts++; },
  });
  assert.equal(result.ok, true); assert.ok(result.message.includes('原帳號'));
  assert.equal(signouts, 0); assert.equal(store.values.has(GOOGLE_AUTH_INTENT_KEY), false);
});
test('callback initialization errors never claim success from a pre-existing Google session', async () => {
  const result = await completeGoogleAuthReturn({ requested: true, intent: intent(), error: null, allowExchange: true }, storage(), {
    async initialize() { return { error: { code: 'bad_code_verifier' } }; }, async getSession() { throw new Error('must not inspect stale session'); }, async signOut() {},
  });
  assert.equal(result.ok, false);
});
test('a callback with the wrong UUID clears only that local session and never edits record storage', async () => {
  const store = storage(); store.values.set('old-record', 'retained');
  const signs: unknown[] = [];
  const result = await completeGoogleAuthReturn({ requested: true, intent: intent('link'), error: null, allowExchange: true }, store, {
    async initialize() { return { error: null }; }, async getSession() { return { data: { session: { user: { ...linked, id: 'other' } } }, error: null }; }, async signOut(options) { signs.push(options); },
  });
  assert.equal(result.ok, false); assert.deepEqual(signs, [{ scope: 'local' }]); assert.equal(store.values.get('old-record'), 'retained');
});
test('the PKCE transport blocks a mismatched linked user before the auth SDK receives a successful token response', async () => {
  const plan = { requested: true, intent: intent('link'), error: null as string | null, allowExchange: true };
  const transport = googleAuthFetch(async () => Response.json({ access_token: 'new-token', user: { id: 'different-user' } }), origin, plan);
  const response = await transport(`${origin}/auth/v1/token?grant_type=pkce`, { method: 'POST' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'google_identity_mismatch');
  assert.ok(plan.error!.includes('原帳號不同'));
});
test('the PKCE transport preserves matching users and leaves ordinary refresh requests unchanged', async () => {
  const plan = { requested: true, intent: intent('link'), error: null, allowExchange: true };
  const init = { method: 'POST', body: 'refresh-body' }; let seen: RequestInit | undefined;
  const transport = googleAuthFetch(async (_url, options) => { seen = options; return Response.json({ user: linked }); }, origin, plan);
  assert.equal((await transport(`${origin}/auth/v1/token?grant_type=pkce`, init)).status, 200);
  await transport(`${origin}/auth/v1/token?grant_type=refresh_token`, init);
  assert.equal(seen, init);
});
test('provider, manual-linking and identity errors are actionable and hide raw server messages', () => {
  for (const code of ['provider_disabled', 'manual_linking_disabled', 'identity_already_exists', 'google_identity_mismatch']) {
    const message = googleAuthErrorMessage({ code, message: 'private credential value' });
    assert.ok(message.length > 10); assert.ok(!message.includes('private credential'));
  }
});
