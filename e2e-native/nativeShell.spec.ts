import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { showMobileSection } from '../e2e/helpers/siteNavigation.ts';

const api = 'https://arxbirgujbrtzhoficdf.supabase.co', date = '2026-11-18';
const account = '00000000-0000-0000-0000-000000000190';
type Probe = { calls: { plugin: string; method: string; options: Record<string, string> }[]; callbacks: Record<string, (value: unknown) => void> };
declare global { interface Window { nativeProbe: Probe } }
async function bridge(page: Page, ios: boolean, launch = ''): Promise<void> {
  await page.addInitScript(({ ios, launch }) => {
    if (ios) Object.defineProperty(window, 'webkit', { configurable: true, value: { messageHandlers: { bridge: {} } } });
    else Object.assign(window, { androidBridge: {} });
    window.nativeProbe = { calls: [], callbacks: {} };
    const methods: Record<string,string[]> = { App: ['getLaunchUrl','minimizeApp'], Browser: ['open','close'],
      Filesystem: ['readdir','writeFile','deleteFile'], Share: ['share'], Clipboard: ['write'] };
    Object.assign(window, { Capacitor: {
      PluginHeaders: Object.entries(methods).map(([name, names]) => ({ name, methods: [
        ...names.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' },
      ] })),
      nativePromise: async (plugin: string, method: string, options: Record<string,string>) => {
        window.nativeProbe.calls.push({ plugin, method, options });
        if (method === 'getLaunchUrl') return launch ? { url: launch } : {};
        if (method === 'readdir') return { files: [] };
        if (method === 'writeFile') return { uri: 'file:///private-cache/' + options.path };
        return {};
      },
      nativeCallback: (plugin: string, _method: string, options: {eventName:string}, callback: (value: unknown) => void) => {
        window.nativeProbe.callbacks[plugin + ':' + options.eventName] = callback; return Promise.resolve('listener-id');
      },
    } });
  }, { ios, launch });
  await page.route(api + '/**', route => route.fulfill({ json: [] }));
}
async function openApp(page: Page): Promise<void> {
  await showMobileSection(page, 'tools'); await page.locator('#siteAppSettings').click();
  await expect(page.locator('#siteAppDialog')).toBeVisible();
}
test.use({ timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });

test('bundled native settings hide install and backup controls while preserving records and account help', async ({ page }, info) => {
  await bridge(page, info.project.name === 'ios-bridge');
  await page.goto('/privacy.html');
  await page.evaluate(date => {
    localStorage.setItem('study-v11:meta:active-record-prefix','study-v11:guest:');
    localStorage.setItem('study-v11:guest:' + date, JSON.stringify({ date, notes: '原生 App 的備份', items: [] }));
  }, date);
  await openApp(page);
  await expect(page.locator('[data-app-install]')).toBeHidden();
  await expect(page.locator('[data-offline-info]')).toContainText('App 已內建離線頁面');
  await expect(page.locator('#siteAppDialog')).not.toContainText('裝置備份與容量');
  await expect(page.locator('[data-app-export], [data-app-backup], [data-app-persist]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '申請刪除帳號與資料' })).toHaveAttribute('href', 'https://myself.liviayeh.dev/support.html#account-deletion');
  const calls = await page.evaluate(() => window.nativeProbe.calls);
  expect(calls.some(call => call.plugin === 'Filesystem' || call.plugin === 'Share')).toBe(false);
  expect(await page.evaluate(date => JSON.parse(localStorage.getItem('study-v11:guest:' + date)!).notes, date)).toBe('原生 App 的備份');
  expect(await page.evaluate(() => navigator.serviceWorker?.controller)).toBeNull();
  await page.screenshot({ path: info.outputPath('native-app-settings.png') });
});

test('native Google sign-in opens the system browser and exchanges only the app PKCE verifier on return', async ({ page }, info) => {
  await bridge(page, info.project.name === 'ios-bridge');
  let challenge = '', exchanged = 0;
  const records = new Map<string, unknown>();
  const user = { id: account, email: 'native@example.test', aud: 'authenticated', role: 'authenticated',
    app_metadata: { provider: 'google', providers: ['google'] }, identities: [{ provider:'google', id: 'google-native' }] };
  const session = { access_token: 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({sub:account,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url') + '.test',
    refresh_token: 'test-native-refresh', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, token_type:'bearer', user };
  await page.route(api + '/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === '/auth/v1/token') {
      exchanged++; expect(createHash('sha256').update(request.postDataJSON().code_verifier).digest('base64url')).toBe(challenge);
      return route.fulfill({ json: session });
    }
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
    if (url.pathname.endsWith('/rpc/upsert_study_record')) {
      const body=request.postDataJSON(); const row={study_date:body.p_study_date,payload:body.p_payload,revision:1,updated_at:new Date().toISOString()};
      records.set(body.p_study_date,row); return route.fulfill({ json:{...row,applied:true} });
    }
    if (url.pathname.endsWith('/study_records')) return route.fulfill({json:[...records.values()]});
    if (url.pathname.includes('/functions/')) return route.fulfill({json:{connected:false,tasks:[]}});
    return route.fulfill({json:[]});
  });
  await page.goto('/index.html?date=' + date);
  await page.locator('#notes').fill('登入前原生草稿');
  await page.locator('#notes').blur();
  await page.locator('#connectionSettings summary').click();
  await page.locator('#cloudGoogleSignInBtn').click();
  await expect.poll(() => page.evaluate(() => window.nativeProbe.calls.filter(call => call.plugin==='Browser'&&call.method==='open').length)).toBe(1);
  const url = new URL(await page.evaluate(() => window.nativeProbe.calls.find(call => call.plugin==='Browser'&&call.method==='open')!.options.url));
  expect(url.searchParams.get('redirect_to')).toBe('gsattracker://auth/callback?google_auth=1');
  challenge=url.searchParams.get('code_challenge')!;
  await page.evaluate(() => window.nativeProbe.callbacks['App:appUrlOpen']({url:'gsattracker://auth/callback?google_auth=1&code=native-test-code'}));
  await expect(page.locator('#cloudUserEmail')).toHaveText(user.email);
  await expect(page.locator('#notes')).toHaveValue('登入前原生草稿');
  expect(exchanged).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('study-v11:meta:active-record-prefix'))).toBe('study-v11:user:' + account + ':');
});

test('a cold callback is consumed once and later navigation cannot replay it', async ({ page }, info) => {
  await bridge(page, info.project.name === 'ios-bridge', 'gsattracker://auth/callback?google_auth=1&code=no-matching-intent');
  let tokenRequests=0; page.on('request', request => { if(request.url().includes('/auth/v1/token')) tokenRequests++; });
  await page.goto('/index.html');
  await expect(page.locator('#cloudGoogleMessage')).toContainText('已過期');
  await page.goto('/privacy.html');
  await expect(page).toHaveURL(/privacy\.html$/);
  await expect(page.locator('html')).toHaveAttribute('data-native-app','true');
  expect(tokenRequests).toBe(0);
});

test('native system back closes a dialog and leaves the record available', async ({ page }, info) => {
  await bridge(page, info.project.name === 'ios-bridge'); await page.goto('/privacy.html'); await openApp(page);
  await expect(page.locator('[data-app-close]')).toBeEnabled();
  await page.evaluate(() => window.nativeProbe.callbacks['App:backButton']({canGoBack:false}));
  await expect(page.locator('#siteAppDialog')).not.toBeVisible();
  expect(await page.evaluate(() => window.nativeProbe.calls.some(call => call.method==='minimizeApp'))).toBe(false);
});

test('cancelling native Google consent preserves the guest scope and its draft', async ({ page }, info) => {
  await bridge(page, info.project.name === 'ios-bridge');
  let tokenRequests=0; page.on('request', request => { if(request.url().includes('/auth/v1/token')) tokenRequests++; });
  await page.goto('/index.html?date=' + date);
  await page.locator('#notes').fill('取消登入仍保留的草稿'); await page.locator('#notes').blur();
  await page.locator('#connectionSettings summary').click(); await page.locator('#cloudGoogleSignInBtn').click();
  await expect.poll(() => page.evaluate(() => window.nativeProbe.calls.filter(call => call.plugin==='Browser'&&call.method==='open').length)).toBe(1);
  await page.evaluate(() => window.nativeProbe.callbacks['App:appUrlOpen']({url:'gsattracker://auth/callback?google_auth=1&error=access_denied'}));
  await expect(page.locator('#cloudGoogleMessage')).toContainText('已取消');
  await expect(page.locator('#notes')).toHaveValue('取消登入仍保留的草稿');
  expect(await page.evaluate(() => localStorage.getItem('study-v11:meta:active-record-prefix'))).toBe('study-v11:guest:');
  expect(tokenRequests).toBe(0);
});

test('native PDF and Word exports share actual file bytes without changing vocabulary', async ({ page }, info) => {
  await bridge(page, info.project.name === 'ios-bridge'); await page.goto('/vocabulary.review.html');
  await page.evaluate(date => {
    localStorage.setItem('study-v11:meta:active-record-prefix','study-v11:guest:');
    localStorage.setItem('study-v11:guest:' + date,JSON.stringify({date,items:[
      {id:'words',type:'englishVocabInteractive',minutes:'',done:false,required:false,
        f:{words:[{text:'native',adjective:true,translation:'原生的'}]}}
    ]}));
  },date);
  await page.reload();
  const original = await page.evaluate(date => localStorage.getItem('study-v11:guest:' + date),date);
  for (const [index,format] of ['pdf','docx'].entries()) {
    await page.locator('#vocabularyExportFormat').selectOption(format);
    await page.getByRole('button',{name:'有翻譯',exact:true}).click();
    await expect.poll(() => page.evaluate(() => window.nativeProbe.calls.filter(call => call.plugin==='Share').length)).toBe(index+1);
    const file = await page.evaluate(() => window.nativeProbe.calls.filter(call => call.plugin==='Filesystem'&&call.method==='writeFile').at(-1)!.options);
    expect(file.path).toMatch(new RegExp('\\.' + format + '$'));
    const bytes=Buffer.from(file.data,'base64');
    expect(bytes.subarray(0,format==='pdf'?4:2).toString()).toBe(format==='pdf'?'%PDF':'PK');
  }
  expect(await page.evaluate(date => localStorage.getItem('study-v11:guest:' + date),date)).toBe(original);
});
