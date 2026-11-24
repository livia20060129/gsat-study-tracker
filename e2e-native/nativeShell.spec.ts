import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { showMobileSection } from '../e2e/helpers/siteNavigation.ts';
import type { LockTimerSession } from '../src/native/lockTimerState.ts';
import { decodeStudyRecord } from '../src/storage/studyRecordCodec.ts';
import { findCompletionItem } from '../src/study/completionTree.ts';

const api = 'https://arxbirgujbrtzhoficdf.supabase.co', date = '2026-11-18';
const account = '00000000-0000-0000-0000-000000000190';
type Probe = { calls: { plugin: string; method: string; options: Record<string, string> }[]; callbacks: Record<string, (value: unknown) => void>;
  timer: { current: LockTimerSession | null; pending: LockTimerSession[]; available: boolean } };
declare global { interface Window { nativeProbe: Probe } }
async function bridge(page: Page, ios: boolean, launch = ''): Promise<void> {
  await page.addInitScript(({ ios, launch }) => {
    if (ios) Object.defineProperty(window, 'webkit', { configurable: true, value: { messageHandlers: { bridge: {} } } });
    else Object.assign(window, { androidBridge: {} });
    window.nativeProbe = { calls: [], callbacks: {}, timer: JSON.parse(sessionStorage.getItem('native-test-timer') || '{"current":null,"pending":[],"available":true}') };
    const methods: Record<string,string[]> = { App: ['getLaunchUrl','minimizeApp'], Browser: ['open','close'],
      Filesystem: ['readdir','writeFile','deleteFile'], Share: ['share'], Clipboard: ['write'], StudyLockTimer: ['getState','publish','acknowledge','clear'] };
    Object.assign(window, { Capacitor: {
      PluginHeaders: Object.entries(methods).map(([name, names]) => ({ name, methods: [
        ...names.map(name => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' },
      ] })),
      nativePromise: async (plugin: string, method: string, options: Record<string,string>) => {
        window.nativeProbe.calls.push({ plugin, method, options });
        if (plugin === 'StudyLockTimer') {
          const timer = window.nativeProbe.timer;
          const args = options as unknown as { session: LockTimerSession; expectedId: string; expectedRevision: number; id: string; revision: number; preserve: boolean; discard: boolean; accumulatedSeconds: number; startedAt: number | null };
          const dirty = (s: LockTimerSession) => s.accumulatedSeconds !== s.baseAccumulatedSeconds || s.startedAt !== s.baseStartedAt;
          const envelope = (applied = true) => {
            sessionStorage.setItem('native-test-timer', JSON.stringify(timer));
            return structuredClone({ ...timer, pending: [...timer.pending, ...(timer.current && dirty(timer.current) ? [timer.current] : [])], applied, reason: timer.available ? '' : 'notifications-denied' });
          };
          if (method === 'getState') return envelope();
          if (method === 'acknowledge') {
            const target = timer.current?.id === args.id ? timer.current : timer.pending.find(s => s.id === args.id);
            if (!target) return envelope();
            if (args.revision > target.revision || (args.discard && args.revision !== target.revision)) return envelope(false);
            target.baseAccumulatedSeconds = args.discard ? target.accumulatedSeconds : args.accumulatedSeconds;
            target.baseStartedAt = args.discard ? target.startedAt : args.startedAt;
            timer.pending = timer.pending.filter(dirty); return envelope();
          }
          const expectedId = method === 'publish' ? args.expectedId : args.id;
          const expectedRevision = method === 'publish' ? args.expectedRevision : args.revision;
          if ((timer.current?.id ?? '') !== expectedId || (timer.current?.revision ?? 0) !== expectedRevision) return envelope(false);
          if (method === 'publish') {
            if (timer.current && dirty(timer.current)) {
              if (timer.current.id === args.session.id) return envelope(false);
              timer.pending.push(timer.current);
            }
            timer.current = { ...args.session, revision: (timer.current?.revision ?? 0) + 1 };
          } else if (method === 'clear') {
            if (timer.current && args.preserve && dirty(timer.current)) timer.pending.push(timer.current);
            if (!args.preserve) timer.pending = timer.pending.filter(s => s.id !== args.id);
            timer.current = null;
          }
          return envelope();
        }
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

async function seedTimer(page: Page, ios: boolean, day = date, scheduled = false): Promise<void> {
  await bridge(page, ios); await page.clock.setFixedTime(new Date('2026-11-18T12:00:00+08:00'));
  await page.goto('/privacy.html');
  await page.evaluate(({day, scheduled}) => {
    localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:guest:');
    localStorage.setItem('study-v11:guest:' + day, JSON.stringify({ date: day, notes: '保留原筆記', items: [{ id: 'native-time', type: 'extra', source: scheduled ? 'preset' : 'custom', presetKey: scheduled ? 'native-timer-preset' : undefined,
      title: '鎖定測試｜三角函數', required: true, done: false, minutes: '2', f: { title: '三角函數', timeTracking: { mode: 'timer', accumulatedSeconds: 120, startedAt: null } } }] }));
  }, {day, scheduled});
  await page.goto('/index.html?date=' + day);
  await expect(page.locator('#dailyItemList [data-item], #itemList [data-item]').filter({ hasText: '鎖定測試｜三角函數' }).first()).toBeVisible();
}
async function storedTimer(page: Page, day = date) {
  const raw = await page.evaluate(day => localStorage.getItem('study-v11:guest:' + day), day);
  const decoded = decodeStudyRecord(raw, day); expect(decoded.ok).toBe(true); if (!decoded.ok) throw new Error('Unreadable fixture');
  return decoded.record;
}
async function nativeTimerAction(page: Page, running: boolean, notify = true): Promise<void> {
  await page.evaluate(({ running, notify }) => {
    const timer = window.nativeProbe.timer, current = timer.current!;
    if ((current.startedAt !== null) === running) return;
    if (running) current.startedAt = Date.now();
    else { current.accumulatedSeconds += Math.max(0, Math.floor((Date.now() - current.startedAt!) / 1000)); current.startedAt = null; }
    current.revision++;
    sessionStorage.setItem('native-test-timer', JSON.stringify(timer));
    if (notify) window.nativeProbe.callbacks['StudyLockTimer:timerChanged']?.({});
  }, { running, notify });
}

test('lock-screen pause and resume survive a suspended WebView and reload, then finish into the original card', async ({ page }, info) => {
  await seedTimer(page, info.project.name === 'ios-bridge');
  const card = page.locator('#itemList [data-item="native-time"]');
  await card.locator('[data-action="timer-toggle"]').click();
  await expect.poll(() => page.evaluate(() => window.nativeProbe.timer.current?.startedAt)).not.toBeNull();
  expect(await page.evaluate(() => window.nativeProbe.timer.current?.title)).toContain('三角函數');
  await page.clock.setFixedTime(new Date('2026-11-18T12:01:05+08:00'));
  await nativeTimerAction(page, false, false);
  await page.reload();
  await expect(card.locator('[data-action="timer-toggle"]')).toHaveText('繼續');
  await expect(card.locator('[data-timer-display]')).toHaveText('03:05');
  let record = await storedTimer(page); const item = record.items.find(item => item.id === 'native-time')!;
  expect(item.minutes).toBe('2'); expect(item.f.timeTracking?.accumulatedSeconds).toBe(185); expect(record.notes).toBe('保留原筆記');
  await nativeTimerAction(page, true);
  await expect(card.locator('[data-action="timer-toggle"]')).toHaveText('暫停');
  await page.clock.setFixedTime(new Date('2026-11-18T12:01:25+08:00'));
  await card.locator('[data-action="timer-finish"]').click();
  await expect.poll(() => page.evaluate(() => window.nativeProbe.timer.current)).toBeNull();
  record = await storedTimer(page); expect(record.items.find(item => item.id === 'native-time')!.minutes).toBe('3.4');
});

test('native actions update a visible timer without replacing an unfinished notes editor', async ({ page }, info) => {
  await seedTimer(page, info.project.name === 'ios-bridge');
  const card = page.locator('#itemList [data-item="native-time"]');
  await card.locator('[data-action="timer-toggle"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.nativeProbe.timer.current))).toBe(true);
  await page.locator('#notes').fill('還在編輯的筆記，不可被計時操作取代');
  await page.clock.setFixedTime(new Date('2026-11-18T12:01:00+08:00'));
  await nativeTimerAction(page, false);
  await expect(card.locator('[data-action="timer-toggle"]')).toHaveText('繼續');
  await expect(page.locator('#notes')).toHaveValue('還在編輯的筆記，不可被計時操作取代');
  expect((await storedTimer(page)).items.find(item => item.id === 'native-time')!.f.timeTracking?.accumulatedSeconds).toBe(180);
});

test('Tracker and todo keep one native session and lock controls change the saved source day', async ({ page }, info) => {
  const day = '2026-11-17'; await seedTimer(page, info.project.name === 'ios-bridge', day, true);
  const card = page.locator('#dailyItemList [data-item], #itemList [data-item]').filter({ hasText: '鎖定測試｜三角函數' }).first();
  await card.locator('[data-action="timer-toggle"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.nativeProbe.timer.current))).toBe(true);
  const session = await page.evaluate(() => window.nativeProbe.timer.current!.id);
  await page.goto('/todo.html?period=all');
  await expect(page.locator('.todo-card').filter({ has: page.locator('[data-item-id="native-time"]') })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.nativeProbe.timer.current?.id)).toBe(session);
  await page.clock.setFixedTime(new Date('2026-11-18T12:00:30+08:00')); await nativeTimerAction(page, false);
  await expect.poll(async () => findCompletionItem((await storedTimer(page, day)).items, 'native-time')!.f.timeTracking?.startedAt).toBeNull();
  await page.goto('/index.html?date=' + day);
  await expect(card.locator('[data-action="timer-toggle"]')).toHaveText('繼續');
});

test('account switching hides the prior timer and retains its pending actions until that account is selected again', async ({ page }, info) => {
  await seedTimer(page, info.project.name === 'ios-bridge');
  await page.locator('#itemList [data-item="native-time"] [data-action="timer-toggle"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.nativeProbe.timer.current))).toBe(true);
  await page.clock.setFixedTime(new Date('2026-11-18T12:00:40+08:00')); await nativeTimerAction(page, false, false);
  // Switching scope before delivery must archive, rather than apply, the previous account's action.
  await page.evaluate(() => {
    localStorage.setItem('study-v11:user:another:2026-11-18', JSON.stringify({ date: '2026-11-18', items: [], notes: '另一帳號紀錄' }));
    localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:user:another:');
    window.dispatchEvent(new Event('study-record-scope-changed'));
  });
  await expect.poll(() => page.evaluate(() => window.nativeProbe.timer.current)).toBeNull();
  expect(await page.evaluate(() => window.nativeProbe.timer.pending.length)).toBe(1);
  await page.goto('/privacy.html');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('study-v11:user:another:2026-11-18')!).notes)).toBe('另一帳號紀錄');
  await page.evaluate(() => { localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:guest:'); window.dispatchEvent(new Event('study-record-scope-changed')); });
  await expect.poll(async () => (await storedTimer(page)).items.find(item => item.id === 'native-time')!.f.timeTracking?.accumulatedSeconds).toBe(160);
});

test('failed browser storage leaves the native action pending and a later foreground retry confirms it', async ({ page }, info) => {
  await seedTimer(page, info.project.name === 'ios-bridge');
  await page.locator('#itemList [data-item="native-time"] [data-action="timer-toggle"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.nativeProbe.timer.current))).toBe(true);
  await page.evaluate(() => {
    Object.assign(window, { failTimerWrite: true }); const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if ((window as unknown as { failTimerWrite: boolean }).failTimerWrite && key === 'study-v11:guest:2026-11-18') throw new DOMException('blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.clock.setFixedTime(new Date('2026-11-18T12:00:25+08:00')); await nativeTimerAction(page, false);
  await expect(page.locator('[data-native-timer-notice]')).toContainText('尚未寫回');
  expect(await page.evaluate(() => window.nativeProbe.timer.current!.startedAt)).toBeNull();
  expect((await storedTimer(page)).items.find(item => item.id === 'native-time')!.f.timeTracking?.startedAt).not.toBeNull();
  await page.locator('#itemList [data-item="native-time"] [data-action="timer-finish"]').click();
  await expect(page.locator('#status')).toContainText('鎖定畫面的計時尚未確認');
  expect((await storedTimer(page)).items.find(item => item.id === 'native-time')!.minutes).toBe('2');
  expect(await page.evaluate(() => window.nativeProbe.timer.current!.accumulatedSeconds)).toBe(145);
  await page.evaluate(() => { (window as unknown as { failTimerWrite: boolean }).failTimerWrite = false; window.nativeProbe.callbacks['App:appStateChange']?.({ isActive: true }); });
  await expect.poll(async () => (await storedTimer(page)).items.find(item => item.id === 'native-time')!.f.timeTracking?.accumulatedSeconds).toBe(145);
});

test('denied notifications keep the original timer usable and reset ends a paused zero-second native session', async ({ page }, info) => {
  await seedTimer(page, info.project.name === 'ios-bridge');
  await page.evaluate(() => { window.nativeProbe.timer.available = false; });
  const card = page.locator('#itemList [data-item="native-time"]');
  await card.locator('[data-action="timer-toggle"]').click();
  await expect(page.locator('[data-native-timer-notice]')).toContainText('請允許 App 通知');
  await expect(card.locator('[data-action="timer-toggle"]')).toHaveText('暫停');
  await card.locator('[data-action="timer-reset"]').click();
  await expect.poll(() => page.evaluate(() => window.nativeProbe.timer.current)).toBeNull();
  expect((await storedTimer(page)).items.find(item => item.id === 'native-time')!.f.timeTracking?.accumulatedSeconds).toBe(0);
  await page.evaluate(() => { window.nativeProbe.timer.available = true; });
  await card.locator('[data-action="timer-toggle"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.nativeProbe.timer.current))).toBe(true);
  await card.locator('[data-action="timer-toggle"]').click();
  await expect.poll(() => page.evaluate(() => window.nativeProbe.timer.current?.startedAt)).toBeNull();
  await card.locator('[data-action="timer-reset"]').click();
  await expect.poll(() => page.evaluate(() => window.nativeProbe.timer.current)).toBeNull();
});

test('bundled native settings hide install and backup controls while preserving records and account help', async ({ page }, info) => {
  await bridge(page, info.project.name === 'ios-bridge');
  await page.goto('/privacy.html');
  await page.evaluate(date => {
    localStorage.setItem('study-v11:meta:active-record-prefix','study-v11:guest:');
    localStorage.setItem('study-v11:guest:' + date, JSON.stringify({ date, notes: '原生 App 的備份', items: [] }));
  }, date);
  await openApp(page);
  await expect(page.locator('[data-app-install]')).toBeHidden();
  await expect(page.locator('[data-offline-info]')).toBeHidden();
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  await expect(page.locator('[data-app-current-version]')).toHaveText(`v${version}`);
  await expect(page.locator('[data-app-latest-version]')).toHaveText('請至商店查看');
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
