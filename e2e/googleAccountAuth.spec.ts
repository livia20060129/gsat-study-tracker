import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { goHome } from './helpers/siteNavigation.ts';
import { decodeStudyRecord } from '../src/storage/studyRecordCodec.ts';

test.use({ timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });
const date = '2026-11-14';
const epoch = new Date('2026-11-15T12:00:00+08:00').getTime();
const api = 'https://arxbirgujbrtzhoficdf.supabase.co';
const userId = '00000000-0000-0000-0000-000000000180';
const wrongId = '00000000-0000-0000-0000-000000000181';
const prefix = `study-v11:user:${userId}:`;
const authKey = 'sb-arxbirgujbrtzhoficdf-auth-token';
const activeKey = 'study-v11:meta:active-record-prefix';
const intentKey = 'study-v11:auth:google-intent';
const original = { schemaVersion: 2, date, notes: '原帳號紀錄', items: [{ id: 'original-item', type: 'general', title: '保留項目', source: 'custom', required: false, done: false, minutes: '18', f: {} }] };
const user = (google = false, id = userId) => ({ id, email: 'account@example.test', aud: 'authenticated', role: 'authenticated',
  app_metadata: { provider: google ? 'google' : 'email', providers: google ? ['email', 'google'] : ['email'] },
  identities: google ? [{ id: 'email-identity', provider: 'email' }, { id: 'google-identity', provider: 'google' }] : [{ id: 'email-identity', provider: 'email' }] });
function session(google = false, id = userId) {
  const expires = Math.floor(epoch / 1000) + 7200;
  return { access_token: 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: expires })).toString('base64url') + '.' + Buffer.from('test-signature').toString('base64url'),
    refresh_token: 'persistent-refresh', expires_at: expires, expires_in: 7200, token_type: 'bearer', user: user(google, id) };
}
async function settings(page: Page): Promise<void> {
  if (!await page.locator('#connectionSettings').evaluate(node => (node as HTMLDetailsElement).open)) await page.locator('#connectionSettings summary').click();
}
interface MockState {
  authorizations: URL[]; links: URL[]; challenge: string; redirect: string; tokenRequests: number;
  uploadUsers: string[]; calendarActions: string[]; google: boolean; cancel: boolean; wrong: boolean;
  errorCode: string; providerDisabled: boolean;
}
async function setup(page: Page, signedIn = false): Promise<MockState> {
  await page.clock.setFixedTime(new Date(epoch));
  const state: MockState = { authorizations: [], links: [], challenge: '', redirect: '', tokenRequests: 0, uploadUsers: [], calendarActions: [],
    google: false, cancel: false, wrong: false, errorCode: '', providerDisabled: false };
  const rows = new Map<string, { study_date: string; payload: typeof original; revision: number; updated_at: string }>();
  if (signedIn) rows.set(date, { study_date: date, payload: structuredClone(original), revision: 2, updated_at: '2026-11-14T03:00:00Z' });
  await page.route(`${api}/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === '/auth/v1/authorize') {
      state.authorizations.push(url);
      state.challenge = url.searchParams.get('code_challenge')!;
      state.redirect = url.searchParams.get('redirect_to')!;
      expect(url.searchParams.has('skip_http_redirect')).toBe(false);
      const callback = new URL(state.redirect);
      if (state.providerDisabled) callback.searchParams.set('error_code', 'provider_disabled');
      else callback.searchParams.set('code', 'google-signin-code');
      // WebKit route.fulfill cannot synthesize an HTTP redirect response.
      return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(callback.href)})</script>` });
    }
    if (url.pathname === '/auth/v1/user/identities/authorize') {
      state.links.push(url);
      state.challenge = url.searchParams.get('code_challenge')!;
      state.redirect = url.searchParams.get('redirect_to')!;
      if (state.errorCode) return route.fulfill({ status: 422, headers: {
        'X-Supabase-Api-Version': '2024-01-01', 'Access-Control-Expose-Headers': 'X-Supabase-Api-Version',
      }, json: { code: state.errorCode, msg: 'private-internal-server-detail' } });
      return route.fulfill({ json: { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=server-signed-state' } });
    }
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'pkce') {
        state.tokenRequests++;
        const body = request.postDataJSON();
        expect(createHash('sha256').update(body.code_verifier).digest('base64url')).toBe(state.challenge);
        state.google = !state.wrong;
        return route.fulfill({ json: session(true, state.wrong ? wrongId : userId) });
      }
      return route.fulfill({ json: session(state.google) });
    }
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user(state.google) });
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname.includes('/functions/')) {
      const action = request.postData()?.startsWith('{') ? request.postDataJSON().action : '';
      state.calendarActions.push(action || '');
      return route.fulfill({ json: { connected: signedIn, calendar_id: 'primary', tasks: [], last_synced_at: '2026-11-14T03:00:00Z' } });
    }
    if (url.pathname.endsWith('/rest/v1/study_records')) {
      const wanted = url.searchParams.get('study_date')?.replace(/^eq\./, '');
      return route.fulfill({ json: [...rows.values()].filter(row => !wanted || row.study_date === wanted) });
    }
    if (url.pathname.endsWith('/rpc/upsert_study_record')) {
      const token = request.headers().authorization?.replace(/^Bearer /, '').split('.')[1];
      if (token) state.uploadUsers.push(JSON.parse(Buffer.from(token, 'base64url').toString()).sub);
      const body = request.postDataJSON(), prior = rows.get(body.p_study_date);
      expect(Array.isArray(body.p_payload)).toBe(false);
      const row = { study_date: body.p_study_date, payload: body.p_payload, revision: (prior?.revision ?? 0) + 1, updated_at: '2026-11-15T04:00:00Z' };
      rows.set(row.study_date, row);
      return route.fulfill({ json: { ...row, applied: true } });
    }
    return route.fulfill({ json: [] });
  });
  await page.route('https://accounts.google.com/o/oauth2/**', async route => {
    const callback = new URL(state.redirect);
    callback.searchParams.set(state.cancel ? 'error' : 'code', state.cancel ? 'access_denied' : 'google-link-code');
    return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(callback.href)})</script>` });
  });
  await page.goto('/material.progress.html');
  await page.evaluate(({ signedIn, prefix, authKey, activeKey, original, authSession }) => {
    localStorage.clear();
    const scope = signedIn ? prefix : 'study-v11:guest:';
    localStorage.setItem(activeKey, scope);
    localStorage.setItem(scope + original.date, JSON.stringify(original));
    if (signedIn) localStorage.setItem(authKey, JSON.stringify(authSession));
  }, { signedIn, prefix, authKey, activeKey, original, authSession: session() });
  await page.goto(`/index.html?date=${date}`);
  await settings(page);
  if (signedIn) await expect(page.locator('#cloudGoogleLinkBtn')).toBeEnabled();
  else await expect(page.locator('#cloudGoogleSignInBtn')).toBeVisible();
  return state;
}
async function accountScope(page: Page): Promise<string | null> { return page.evaluate(key => localStorage.getItem(key), activeKey); }
async function saved(page: Page) { return page.evaluate(({ prefix, date }) => JSON.parse(localStorage.getItem(prefix + date)!), { prefix, date }); }

function installLocalStorageBudget(limit: number): void {
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value): void {
    if (this === localStorage) {
      let used = 2 * (String(key).length + String(value).length);
      for (let index = 0; index < this.length; index++) {
        const name = this.key(index)!;
        if (name !== key) used += 2 * (name.length + (this.getItem(name)?.length ?? 0));
      }
      if (used > limit) throw new DOMException('localStorage capacity exceeded', 'QuotaExceededError');
    }
    set.call(this, key, value);
  };
}

test('Google sign-in uses PKCE, saves guest drafts, restores the chosen date and stays signed in across pages', async ({ page }, testInfo) => {
  const state = await setup(page);
  await page.locator('#notes').fill('Google 登入前的訪客草稿');
  await page.locator('#cloudGoogleSignInBtn').click();
  await expect(page.locator('#cloudUserEmail')).toHaveText(user().email);
  await expect(page).toHaveURL(new RegExp(`/index.html\\?date=${date}$`));
  await expect.poll(() => accountScope(page)).toBe(prefix);
  await expect(page.locator('#notes')).toHaveValue('Google 登入前的訪客草稿');
  await expect(page.locator('#cloudGoogleIdentityStatus')).toHaveText('Google 已綁定');
  expect(state.authorizations).toHaveLength(1);
  expect(state.authorizations[0].searchParams.get('scopes')).toBe('openid email profile');
  expect(state.tokenRequests).toBe(1);
  for (const path of ['/todo.html', '/summary.html', '/material.progress.html', '/vocabulary.review.html']) {
    await page.goto(path); await goHome(page);
    await expect(page.locator('#cloudUserEmail')).toHaveText(user().email);
    await expect.poll(() => accountScope(page)).toBe(prefix);
  }
  await page.goto(`/index.html?date=${date}`);
  await expect(page.locator('#notes')).toHaveValue('Google 登入前的訪客草稿');
  await settings(page);
  await page.screenshot({ path: testInfo.outputPath('google-signed-in.png'), fullPage: false });
});

test('linking Google retains the original account UUID, saved work and Calendar connection', async ({ page }) => {
  const state = await setup(page, true);
  await page.locator('#notes').fill('綁定前的原帳號草稿');
  await page.locator('#cloudGoogleLinkBtn').click();
  await expect(page.locator('#cloudGoogleMessage')).toContainText('沿用原帳號');
  await expect(page.locator('#cloudGoogleIdentityStatus')).toHaveText('Google 已綁定');
  await expect(page.locator('#cloudGoogleLinkBtn')).toBeHidden();
  await expect.poll(() => accountScope(page)).toBe(prefix);
  await expect(page.locator('#notes')).toHaveValue('綁定前的原帳號草稿');
  expect((await saved(page)).items.find((item: { id: string }) => item.id === 'original-item').minutes).toBe('18');
  expect(state.links).toHaveLength(1);
  expect(state.calendarActions).not.toContain('disconnect');
  await expect(page.locator('#calendarStatusBadge')).toContainText('已連接');
  await page.reload();
  await expect(page.locator('#cloudGoogleIdentityStatus')).toHaveText('Google 已綁定');
  expect(await accountScope(page)).toBe(prefix);
});

test('a mismatched linked token is rejected before it can replace the original auth session or record scope', async ({ page }) => {
  const state = await setup(page, true); state.wrong = true;
  await page.locator('#cloudGoogleLinkBtn').click();
  await expect(page.locator('#cloudGoogleMessage')).toContainText('原帳號不同');
  await expect(page.locator('#cloudUserEmail')).toHaveText(user().email);
  expect(await accountScope(page)).toBe(prefix);
  expect(state.uploadUsers).not.toContain(wrongId);
  expect(await page.evaluate(({ authKey, wrongId }) => JSON.parse(localStorage.getItem(authKey)!).user.id === wrongId, { authKey, wrongId })).toBe(false);
  expect(await page.evaluate(id => Object.keys(localStorage).some(key => key.startsWith(`study-v11:user:${id}:`)), wrongId)).toBe(false);
  expect((await saved(page)).notes).toBe(original.notes);
});

test('canceling Google linking keeps the original session and all records', async ({ page }) => {
  const state = await setup(page, true); state.cancel = true;
  await page.locator('#cloudGoogleLinkBtn').click();
  await expect(page.locator('#cloudGoogleMessage')).toContainText('已取消');
  expect(state.tokenRequests).toBe(0);
  expect(await accountScope(page)).toBe(prefix);
  await expect(page.locator('#notes')).toHaveValue(original.notes);
});

for (const code of ['manual_linking_disabled', 'identity_already_exists']) test(`linking failure ${code} is actionable, preserves records and allows retry`, async ({ page }) => {
  const state = await setup(page, true); state.errorCode = code;
  await page.locator('#cloudGoogleLinkBtn').click();
  await expect(page.locator('#cloudGoogleMessage')).toContainText(code === 'manual_linking_disabled' ? 'Manual Linking' : '已綁定其他帳號');
  await expect(page.locator('#cloudGoogleMessage')).not.toContainText('private-internal-server-detail');
  await expect(page.locator('#cloudGoogleLinkBtn')).toBeEnabled();
  expect(await accountScope(page)).toBe(prefix);
  expect(state.tokenRequests).toBe(0);
});

test('a disabled Google provider explains setup while retaining guest input', async ({ page }) => {
  const state = await setup(page); state.providerDisabled = true;
  await page.locator('#notes').fill('未啟用時也保留');
  await page.locator('#cloudGoogleSignInBtn').click();
  await expect(page.locator('#cloudGoogleMessage')).toContainText('Google 登入尚未完成設定');
  await expect(page.locator('#notes')).toHaveValue('未啟用時也保留');
  expect(await accountScope(page)).toBe('study-v11:guest:');
  expect(state.tokenRequests).toBe(0);
});

test('failed local draft storage blocks the Google redirect', async ({ page }) => {
  const state = await setup(page);
  await page.locator('#notes').fill('尚未保存的草稿');
  await page.evaluate(date => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value): void {
      if (key === `study-v11:guest:${date}`) throw new DOMException('storage unavailable', 'QuotaExceededError');
      set.call(this, key, value);
    };
  }, date);
  await page.locator('#cloudGoogleSignInBtn').click();
  await expect(page.locator('#cloudGoogleMessage')).toContainText('儲存空間');
  await expect(page.locator('#cloudGoogleMessage')).toContainText('讀書紀錄尚未保存');
  await expect(page.locator('#cloudGoogleMessage')).not.toContainText('登入驗證資料');
  await expect(page.locator('#notes')).toHaveValue('尚未保存的草稿');
  expect(state.authorizations).toHaveLength(0);
});

test('unchanged saved records do not need another record write before Google authentication', async ({ page }) => {
  const state = await setup(page);
  await page.evaluate(date => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value): void {
      if (key === `study-v11:guest:${date}`) throw new DOMException('storage unavailable', 'QuotaExceededError');
      set.call(this, key, value);
    };
  }, date);
  await page.locator('#cloudGoogleSignInBtn').click();
  await expect(page.locator('#cloudUserEmail')).toHaveText(user().email);
  expect(state.authorizations).toHaveLength(1);
  expect(state.tokenRequests).toBe(1);
  expect(await accountScope(page)).toBe(prefix);
});

test('invalid study input names the field and prevents Google navigation without losing its draft', async ({ page }) => {
  const state = await setup(page);
  await page.locator('#todayStatusToggle').click();
  await page.locator('#wakeHour').fill('25');
  await page.locator('#wakeMinute').fill('00');
  await page.locator('#cloudGoogleSignInBtn').click();
  await expect(page.locator('#cloudGoogleMessage')).toContainText('起床時間格式不正確');
  await expect(page.locator('#cloudGoogleMessage')).not.toContainText('登入驗證資料');
  await expect(page.locator('#wakeHour')).toHaveValue('25');
  expect(state.authorizations).toHaveLength(0);
});

test('a callback with a missing intent never exchanges its code or switches accounts', async ({ page }) => {
  const state = await setup(page, true);
  await page.goto(`/index.html?google_auth=1&code=unexpected&date=${date}`);
  await expect(page.locator('#cloudGoogleMessage')).toContainText('登入連結已過期');
  expect(state.tokenRequests).toBe(0);
  expect(await accountScope(page)).toBe(prefix);
  await expect(page.locator('#notes')).toHaveValue(original.notes);
});

test('retired implicit recovery links cannot sign in or overwrite an existing account', async ({ page }) => {
  const state = await setup(page, true);
  const token = session();
  await page.goto(`/index.html#access_token=${token.access_token}&refresh_token=${token.refresh_token}&expires_in=7200&type=recovery`);
  await expect(page.locator('#cloudGoogleMessage')).toContainText('此登入連結已停用');
  await expect(page.locator('#passwordRecoveryDialog')).toHaveCount(0);
  await expect(page.locator('#cloudUserEmail')).toHaveText(user().email);
  expect(await accountScope(page)).toBe(prefix);
  expect((await saved(page)).notes).toBe(original.notes);
  expect(state.tokenRequests).toBe(0);
  expect(new URL(page.url()).hash).toBe('');
});

test('retired email PKCE codes are cleaned without exchanging a code or changing guest data', async ({ page }) => {
  const state = await setup(page);
  await page.evaluate(() => localStorage.setItem('sb-arxbirgujbrtzhoficdf-auth-token-code-verifier', JSON.stringify('old-verifier/recovery')));
  await page.goto(`/index.html?code=recovery-code&date=${date}`);
  await expect(page.locator('#cloudGoogleMessage')).toContainText('此登入連結已停用');
  await expect(page.locator('#passwordRecoveryDialog')).toHaveCount(0);
  await expect(page.locator('#notes')).toHaveValue(original.notes);
  expect(await accountScope(page)).toBe('study-v11:guest:');
  expect(new URL(page.url()).searchParams.has('code')).toBe(false);
  expect(state.tokenRequests).toBe(0);
});

test('Google-only controls retain the original records across logout and Google sign-in without email requests', async ({ page }) => {
  const state = await setup(page, true);
  const emailRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (/\/auth\/v1\/(signup|recover|resend|verify)$/.test(url.pathname) || url.searchParams.get('grant_type') === 'password') emailRequests.push(url.pathname);
  });
  await page.locator('#cloudSignOutBtn').click();
  await expect(page.locator('#cloudGoogleSignInBtn')).toBeVisible();
  await expect(page.locator('#cloudPanel input, #passwordRecoveryDialog, #cloudSignInBtn, #cloudSignUpBtn, #cloudForgotPasswordBtn, #cloudResendVerificationBtn')).toHaveCount(0);
  await page.locator('#cloudGoogleSignInBtn').click();
  await expect(page.locator('#cloudGoogleIdentityStatus')).toHaveText('Google 已綁定');
  expect(await accountScope(page)).toBe(prefix);
  expect((await saved(page)).notes).toBe(original.notes);
  expect((await saved(page)).items.find((item: { id: string }) => item.id === 'original-item').minutes).toBe('18');
  expect(state.tokenRequests).toBe(1);
  expect(emailRequests).toEqual([]);
});

test.describe('mobile save failures', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('save validation stays visible after the feedback folds and clears after a successful save', async ({ page }, testInfo) => {
    await setup(page);
    await page.clock.install({ time: new Date(epoch) });
    await page.locator('#connectionSettings summary').tap();
    await page.locator('#todayStatusToggle').tap();
    await page.locator('#wakeHour').fill('25');
    await page.locator('#wakeMinute').fill('00');
    const before = await page.locator('main').evaluate(node => node.getBoundingClientRect().height);
    await page.locator('#saveBtn').tap();
    const notice = page.locator('#recordSaveFailure');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('起床時間格式不正確');
    await expect(page.locator('#connectionSettings')).not.toHaveAttribute('open', '');
    await page.clock.runFor(6000);
    await expect(notice).toBeVisible();
    expect(await page.locator('main').evaluate(node => node.getBoundingClientRect().height)).toBe(before);
    const box = await notice.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(box!.y + box!.height).toBeLessThanOrEqual(812);
    await page.screenshot({ path: testInfo.outputPath('mobile-save-failure.png'), fullPage: false });
    await notice.getByRole('button', { name: '關閉儲存錯誤提示' }).tap();
    await expect(notice).toBeHidden();
    await page.locator('#wakeHour').fill('07');
    await page.locator('#wakeMinute').fill('30');
    await page.locator('#saveBtn').tap();
    await page.clock.runFor(100);
    await expect(notice).toBeHidden();
    expect(await page.evaluate(date => JSON.parse(localStorage.getItem('study-v11:guest:' + date)!).wakeTime, date)).toBe('07:30');
  });

  test('Google draft failure stays readable on mobile and preserves the entered field', async ({ page }) => {
    const state = await setup(page);
    await page.locator('#todayStatusToggle').tap();
    await page.locator('#wakeHour').fill('25');
    await page.locator('#wakeMinute').fill('00');
    await page.locator('#cloudGoogleSignInBtn').tap();
    await expect(page.locator('#recordSaveFailure')).toBeVisible();
    await expect(page.locator('#recordSaveFailure')).toContainText('讀書紀錄尚未保存');
    await expect(page.locator('#recordSaveFailure')).toContainText('起床時間格式不正確');
    await expect(page.locator('#wakeHour')).toHaveValue('25');
    expect(state.authorizations).toHaveLength(0);
  });
});

test.describe('mobile full localStorage recovery', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('a full guest and pending history saves a draft, signs in and retains every record after reload', async ({ page }, testInfo) => {
    const state = await setup(page);
    const fixtures = await page.evaluate(() => {
      const guests = Array.from({ length: 18 }, (_, i) => ({ schemaVersion: 2, date: `2026-08-${String(i + 1).padStart(2, '0')}`,
        items: [], notes: `第 ${i + 1} 天訪客筆記。`.repeat(450), localDirty: true }));
      const pending = Array.from({ length: 15 }, (_, i) => {
        const base = { schemaVersion: 2, date: `2026-09-${String(i + 1).padStart(2, '0')}`, items: [], notes: `雲端祖先 ${i}。`.repeat(350) };
        return { ...base, notes: `另一帳號的未同步筆記 ${i}。`.repeat(350), serverRevision: 3, localDirty: true, syncBase: base };
      });
      for (const record of guests) localStorage.setItem('study-v11:guest:' + record.date, JSON.stringify(record));
      for (const record of pending) localStorage.setItem('study-v11:user:untouched:' + record.date, JSON.stringify(record));
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i)!; used += 2 * (key.length + localStorage.getItem(key)!.length); }
      return { guests, pending, limit: used + 256 };
    });
    await page.addInitScript(installLocalStorageBudget, fixtures.limit);
    await page.evaluate(installLocalStorageBudget, fixtures.limit);
    const draft = '空間滿時也須保留的登入前草稿。'.repeat(800);
    await page.locator('#notes').fill(draft);
    await page.locator('#cloudGoogleSignInBtn').tap();
    await expect(page.locator('#cloudUserEmail')).toHaveText(user().email);
    await expect.poll(() => accountScope(page)).toBe(prefix);
    await expect(page.locator('#notes')).toHaveValue(draft);
    expect(state.authorizations).toHaveLength(1);
    expect(state.tokenRequests).toBe(1);
    const raw = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => /^study-v11:(guest|user:untouched):\d/.test(key))));
    expect(Object.values(raw).some(value => value.startsWith('["gsat-local-record:deflate-v1"'))).toBe(true);
    for (const record of fixtures.guests) {
      const decoded = decodeStudyRecord(raw['study-v11:guest:' + record.date]);
      expect(decoded.ok).toBe(true); if (decoded.ok) expect(decoded.record).toEqual(record);
    }
    for (const record of fixtures.pending) {
      const decoded = decodeStudyRecord(raw['study-v11:user:untouched:' + record.date]);
      expect(decoded.ok).toBe(true); if (decoded.ok) expect(decoded.record).toEqual(record);
    }
    await expect(page.locator('#recordSaveFailure')).toBeHidden();
    await page.locator('#saveBtn').tap();
    await expect(page.locator('#saveBtn')).toHaveAttribute('data-state', 'success');
    await expect.poll(() => state.uploadUsers.length).toBeGreaterThanOrEqual(fixtures.guests.length + 1);
    await page.reload();
    await expect(page.locator('#notes')).toHaveValue(draft);
    const accountRaw = await page.evaluate(prefix => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith(prefix))), prefix);
    for (const record of fixtures.guests) {
      const decoded = decodeStudyRecord(accountRaw[prefix + record.date]);
      expect(decoded.ok).toBe(true); if (decoded.ok) expect(decoded.record.notes).toBe(record.notes);
    }
    await settings(page);
    await page.screenshot({ path: testInfo.outputPath('mobile-storage-recovered-google-sign-in.png'), fullPage: false });
    console.log('STORAGE_QUOTA_RECOVERY', JSON.stringify({ days: fixtures.guests.length + fixtures.pending.length, originalBudgetBytes: fixtures.limit,
      preservedGuestDays: fixtures.guests.length, preservedPendingDays: fixtures.pending.length, googleSignIns: state.tokenRequests }));
  });

  test('native browser quota is reclaimed without clearing site data or dropping unsynced dates', async ({ page }) => {
    const state = await setup(page);
    const filled = await page.evaluate(() => {
      const records: Array<{ schemaVersion: number; date: string; items: never[]; notes: string; serverRevision: number; localDirty: boolean;
        syncBase: { schemaVersion: number; date: string; items: never[]; notes: string } }> = [];
      let serial = 0, reachedQuota = false;
      for (const size of [4000, 400, 20]) {
        for (let count = 0; count < 256; count++) {
          const date = new Date(Date.UTC(2025, 0, ++serial)).toISOString().slice(0, 10);
          const base = { schemaVersion: 2, date, items: [] as never[], notes: '保留雲端原始內容。'.repeat(size) };
          const record = { ...base, notes: '還沒同步的本機筆記。'.repeat(size), serverRevision: 2, localDirty: true, syncBase: base };
          try { localStorage.setItem('study-v11:user:native-quota:' + date, JSON.stringify(record)); records.push(record); }
          catch (error) {
            if ((error as DOMException).name !== 'QuotaExceededError') throw error;
            reachedQuota = true; break;
          }
        }
      }
      return { records, reachedQuota };
    });
    expect(filled.reachedQuota).toBe(true);
    expect(filled.records.length).toBeGreaterThan(10);
    const draft = '原生容量用滿後保存的訪客草稿。'.repeat(1000);
    await page.locator('#notes').fill(draft);
    await page.locator('#cloudGoogleSignInBtn').tap();
    await expect(page.locator('#cloudUserEmail')).toHaveText(user().email);
    await expect(page.locator('#notes')).toHaveValue(draft);
    expect(state.tokenRequests).toBe(1);
    const raw = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('study-v11:user:native-quota:'))));
    expect(Object.keys(raw)).toHaveLength(filled.records.length);
    for (const record of filled.records) {
      const decoded = decodeStudyRecord(raw['study-v11:user:native-quota:' + record.date]);
      expect(decoded.ok).toBe(true); if (decoded.ok) expect(decoded.record).toEqual(record);
    }
    await page.reload();
    await expect(page.locator('#notes')).toHaveValue(draft);
    console.log('NATIVE_STORAGE_QUOTA_RECOVERY', JSON.stringify({ preservedPendingDays: filled.records.length, googleSignIns: state.tokenRequests }));
  });
});

test.describe('mobile Google access', () => {
  test.use({ viewport: { width: 320, height: 812 }, isMobile: true, hasTouch: true });
  test('the primary Google control is tappable and the callback retains its date without overflow', async ({ page }, testInfo) => {
    await setup(page);
    const primary = page.locator('#cloudGoogleSignInBtn');
    expect(await primary.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await expect(primary.locator('img')).toHaveJSProperty('complete', true);
    await primary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('mobile-google-sign-in.png'), fullPage: false });
    await primary.tap();
    await expect(page.locator('#cloudUserEmail')).toHaveText(user().email);
    await expect(page.locator('#studyDate')).toHaveValue(date);
    await settings(page);
    expect(await page.locator('#cloudPanel').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('mobile-google-account.png'), fullPage: false });
  });
});
