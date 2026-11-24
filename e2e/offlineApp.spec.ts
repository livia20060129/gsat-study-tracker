import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { offlineWorkerSource, type OfflineRelease } from '../scripts/pwaBuild.ts';
import { decodeStudyRecord } from '../src/storage/studyRecordCodec.ts';
import { showMobileSection } from './helpers/siteNavigation.ts';
import { downloadVocabularyPdf } from './helpers/vocabularyPdf.ts';

test.use({ reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
const prefix = 'study-v11:guest:', day = '2026-11-18';
const record = { schemaVersion: 2, date: day, notes: '離線前筆記', items: [{ id: 'offline-words', type: 'englishVocabInteractive', done: false,
  minutes: '3', required: false, source: 'custom', f: { words: [{ text: 'ability', noun: true, translation: '能力' }] } }] };
let server: Server, base: string, release: OfflineRelease, broken = false, networkDown = false;
let transformHtml = false, missingPayload = false, cacheQuota = false, slowCleanup = false;
let payloadGate: { promise: Promise<void>; release(): void } | undefined, payloadRequested = false;
let workerRequests: { broken: boolean; release: string; at: number }[] = [];

test.beforeEach(async ({ context, page }) => {
  release = JSON.parse(await readFile('dist/app-release.json', 'utf8'));
  broken = false; networkDown = false;
  transformHtml = false; missingPayload = false; cacheQuota = false; slowCleanup = false;
  payloadGate = undefined; payloadRequested = false;
  workerRequests = [];
  const root = resolve('dist');
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
  server = createServer((request, response) => void (async () => {
    if (networkDown) { response.destroy(); return; }
    const url = new URL(request.url!, 'http://localhost');
    if (!url.pathname.startsWith('/app/')) { response.writeHead(404).end(); return; }
    let path = decodeURIComponent(url.pathname.slice(5)) || 'index.html';
    if (!extname(path)) path += '.html';
    const file = resolve(root, path);
    if (!file.startsWith(root + sep)) { response.writeHead(404).end(); return; }
    try {
      if (path === 'app-worker.js') workerRequests.push({ broken, release: release.id, at: Date.now() });
      const indexSource = release.resources.find(row => row.path === 'index.html')?.source;
      const todoSource = release.resources.find(row => row.path === 'todo.html')?.source;
      if (payloadGate && path === todoSource) { payloadRequested = true; await payloadGate.promise; }
      if (missingPayload && path === indexSource) { response.writeHead(404).end('not deployed'); return; }
      const quotaProbe = `const put = Cache.prototype.put; Cache.prototype.put = function(request, response) {
        if (String(typeof request === 'string' ? request : request.url).includes('/assets/')) throw new DOMException('full', 'QuotaExceededError');
        return put.call(this, request, response); };\n`;
      const cleanupProbe = `const removeCache = CacheStorage.prototype.delete; CacheStorage.prototype.delete = async function(name) {
        await new Promise(resolve => setTimeout(resolve, 300)); return removeCache.call(this, name); };\n`;
      let content = path === 'app-worker.js' ? Buffer.from((cacheQuota ? quotaProbe : '') + (slowCleanup ? cleanupProbe : '') + offlineWorkerSource(release))
        : path === 'app-release.json' ? Buffer.from(JSON.stringify(release)) : broken && path === todoSource ? Buffer.from(JSON.stringify({ html: 'not the expected release' })) : await readFile(file);
      if (transformHtml && path.endsWith('.html')) content = Buffer.from(content.toString().replace('</body>', '<script>window.__CF$cv$params={r:"test-injected"};</script></body>'));
      response.writeHead(200, { 'Content-Type': (types[extname(path)] || 'application/octet-stream') + (path.endsWith('.html') ? ';charset=utf-8' : ''),
        'Cache-Control': 'no-store' }); response.end(content);
    } catch { response.writeHead(404).end(); }
  })());
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/app/`;
  await page.clock.setFixedTime(new Date('2026-11-18T12:00:00+08:00'));
  await context.route('https://arxbirgujbrtzhoficdf.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto(base + 'privacy.html');
  await page.evaluate(({ prefix, record }) => {
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(prefix + record.date, JSON.stringify(record));
    localStorage.setItem('study-v11:user:other:' + record.date, JSON.stringify({ date: record.date, items: [], notes: '另一帳號保留' }));
    localStorage.setItem('sb-private-token', 'never-cache-or-export');
  }, { prefix, record });
});
test.afterEach(async ({ context }) => {
  payloadGate?.release();
  await context.setOffline(false);
  // Service-worker update requests can hold keepalive sockets after an aborted install.
  server.closeAllConnections(); await new Promise<void>(done => server.close(() => done()));
});
async function open(page: Page): Promise<void> {
  await showMobileSection(page, 'tools');
  const updateNotice = page.locator('.site-app-update button');
  if (await updateNotice.isVisible()) await updateNotice.click();
  else await page.locator('#siteAppSettings').click();
  await expect(page.locator('#siteAppDialog')).toBeVisible();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
}
async function prepare(page: Page): Promise<void> {
  await open(page); await page.locator('[data-offline-prepare]').click();
  await expect(page.locator('[data-offline-info]')).toBeHidden();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
  await expect(page.locator('[data-offline-prepare]')).toHaveAttribute('data-offline-success', 'true');
  await page.locator('[data-app-close]').click();
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
async function notes(page: Page): Promise<string | undefined> {
  const raw = await page.evaluate(key => localStorage.getItem(key), prefix + day);
  const decoded = decodeStudyRecord(raw, day); return decoded.ok ? decoded.record.notes : undefined;
}
async function goOffline(page: Page, context: BrowserContext, browserName: string): Promise<void> {
  networkDown = true;
  if (browserName !== 'webkit') { await context.setOffline(true); return; }
  // Playwright WebKit's offline emulation rejects even literal worker navigation responses.
  // https://github.com/microsoft/playwright/issues/42775
  // Drop every real server request instead, and model only the browser's connectivity signal.
  await context.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); window.dispatchEvent(new Event('offline')); });
}
async function updateReady(page: Page): Promise<void> {
  await open(page);
  release = { ...release, version: '171.6.next', id: release.id + '-next' };
  await page.locator('[data-offline-check]').click();
  await expect(page.locator('[data-offline-update]')).toBeVisible();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
}

test('completed preparation and update checks show a stable green check for five seconds and renew it on retry', async ({ page }, info) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 375, height: 812 }); await open(page);
  await page.evaluate(() => {
    const durations: Record<string, number[]> = {};
    Object.assign(window, { offlineSuccessDurations: durations });
    for (const kind of ['prepare', 'check']) {
      const button = document.querySelector(`[data-offline-${kind}]`)!;
      let started = 0, active = false; durations[kind] = [];
      new MutationObserver(() => {
        const success = button.getAttribute('data-offline-success') === 'true';
        if (success && !active) started = performance.now();
        if (!success && active) durations[kind].push(performance.now() - started);
        active = success;
      }).observe(button, { attributes: true, attributeFilter: ['data-offline-success'] });
    }
  });
  const prepareButton = page.locator('[data-offline-prepare]'), checkButton = page.locator('[data-offline-check]');
  const prepareBounds = await prepareButton.boundingBox();
  expect((await checkButton.boundingBox())!.y).toBe(prepareBounds!.y);
  await prepareButton.click(); await page.mouse.move(0, 0);
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
  await expect(prepareButton).toHaveAttribute('data-offline-success', 'true');
  await expect(prepareButton).toHaveAccessibleName('準備離線使用：已完成');
  await expect(prepareButton).toHaveCSS('background-color', 'rgb(21, 128, 61)');
  await expect(prepareButton.locator('.site-app-success-check')).toHaveCSS('opacity', '1');
  expect(await prepareButton.boundingBox()).toEqual(prepareBounds);
  await page.screenshot({ path: info.outputPath('offline-prepare-success-mobile.png') });
  await expect(prepareButton).not.toHaveAttribute('data-offline-success', { timeout: 7000 });
  await expect(prepareButton).toHaveAccessibleName('準備離線使用');
  await expect(prepareButton.locator('.site-app-success-check')).toHaveCSS('opacity', '0');
  const checkBounds = await checkButton.boundingBox();
  await checkButton.click(); await page.mouse.move(0, 0);
  await expect(checkButton).toHaveAttribute('data-offline-success', 'true');
  await expect(checkButton).toHaveAccessibleName('檢查更新：已完成');
  await expect(checkButton).toHaveCSS('background-color', 'rgb(21, 128, 61)');
  await expect(checkButton.locator('.site-app-success-check')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-app-latest-version]')).toHaveText(`v${release.version}`);
  expect(await checkButton.boundingBox()).toEqual(checkBounds);
  await page.screenshot({ path: info.outputPath('update-check-success-mobile.png') });
  // Retry during the five-second feedback, so its previous timer must be cancelled.
  await page.waitForTimeout(3500); await checkButton.click();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
  await expect(checkButton).toHaveAttribute('data-offline-success', 'true');
  await expect(checkButton).not.toHaveAttribute('data-offline-success', { timeout: 7000 });
  await expect(checkButton).toHaveAccessibleName('檢查更新');
  await expect(page.locator('[data-offline-info]')).toBeHidden();
  const durations = await page.evaluate(() => (window as unknown as { offlineSuccessDurations: Record<string, number[]> }).offlineSuccessDurations);
  for (const duration of [durations.prepare.at(-1)!, durations.check.at(-1)!]) {
    expect(duration).toBeGreaterThanOrEqual(4900); expect(duration).toBeLessThan(6500);
  }
});

test('a new release is not marked successful while its offline payload is still downloading', async ({ page }) => {
  await prepare(page); await open(page);
  release = { ...release, version: '171.6.next', id: release.id + '-held' };
  let releaseDownload!: () => void;
  payloadGate = { promise: new Promise<void>(resolve => { releaseDownload = resolve; }), release: () => releaseDownload() };
  const button = page.locator('[data-offline-check]');
  await button.click();
  await expect.poll(() => payloadRequested).toBe(true);
  await expect(button).not.toHaveAttribute('data-offline-success');
  await expect(button).toBeDisabled();
  await expect(page.locator('[data-offline-info]')).toContainText('正在檢查並核對更新');
  payloadGate.release();
  await expect(button).toHaveAttribute('data-offline-success', 'true');
  await expect(button).toBeEnabled();
  await expect(page.locator('[data-offline-update]')).toBeVisible();
  await expect(page.locator('[data-offline-info]')).toContainText('新版已下載');
  // A newer valid release may replace an already verified waiting worker.
  release = { ...release, id: release.id + '-newer' }; payloadGate = undefined;
  await button.click();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
  await expect(button).toHaveAttribute('data-offline-success', 'true');
  await expect(page.locator('[data-offline-info]')).toHaveAttribute('data-error', 'false');
  await expect(page.locator('[data-offline-update]')).toBeVisible();
  expect(await notes(page)).toBe('離線前筆記');
});

test('failed update checks clear the previous success, retain records and allow a successful retry', async ({ page }) => {
  await prepare(page); await open(page);
  const button = page.locator('[data-offline-check]');
  await button.click(); await expect(button).toHaveAttribute('data-offline-success', 'true');
  networkDown = true; await button.click();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
  await expect(page.locator('[data-offline-info]')).toHaveAttribute('data-error', 'true');
  await expect(page.locator('[data-app-status]')).toHaveAttribute('data-error', 'true');
  await expect(button).not.toHaveAttribute('data-offline-success');
  await expect(page.locator('[data-offline-prepare]')).not.toHaveAttribute('data-offline-success');
  expect(await notes(page)).toBe('離線前筆記');
  networkDown = false; await button.click();
  await expect(button).toHaveAttribute('data-offline-success', 'true');
  await expect(page.locator('[data-offline-info]')).toHaveAttribute('data-error', 'false');
  await expect(page.locator('[data-app-status]')).toHaveText('');
  await expect(page.locator('[data-app-status]')).toHaveAttribute('data-error', 'false');
});

for (const profile of [
  { name: 'desktop', viewport: { width: 1280, height: 720 } },
  { name: 'Android touch', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' },
  { name: 'iPhone touch', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' },
]) test.describe(profile.name, () => {
  test.use(profile);
  test('offline relaunch, local edits and account separation survive each primary page', async ({ page, context, browserName }, info) => {
    await prepare(page);
    await page.evaluate(() => fetch('./dictionaries/ecdict-v1/00.json').then(response => response.json()));
    await goOffline(page, context, browserName);
    for (const path of ['index.html?date=' + day, 'todo?period=week', 'summary.html', 'material.progress.html', 'vocabulary.review.html', 'gpt.prompt.html']) {
      await page.goto(base + path);
      await expect(page.locator('#siteAppDialog')).toHaveCount(1);
      await expect(page.locator('body')).toHaveClass(/has-site-shell/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (path === 'vocabulary.review.html') {
        const pdf = await downloadVocabularyPdf(page, true, info.outputPath('offline.pdf'));
        expect(pdf.text).toContain('ability'); expect(pdf.text).toContain('能力');
        await page.locator('#vocabularyExportFormat').selectOption('docx');
        const download = page.waitForEvent('download');
        await page.locator('[data-export-vocabulary="translated"]').click();
        const docx = await download; expect(docx.suggestedFilename()).toMatch(/\.docx$/);
        await docx.saveAs(info.outputPath('offline.docx')); expect(await docx.failure()).toBeNull();
      }
    }
    await page.goto(base + 'index.html?date=' + day);
    await expect(page.locator('#notes')).toHaveValue('離線前筆記');
    await page.locator('#notes').fill('斷網後保存的筆記'); await page.locator('#notes').blur();
    await expect.poll(() => notes(page)).toBe('斷網後保存的筆記');
    await page.reload(); await expect(page.locator('#notes')).toHaveValue('斷網後保存的筆記');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('study-v11:user:other:2026-11-18')!).notes)).toBe('另一帳號保留');
    expect(await page.evaluate(() => fetch('./dictionaries/ecdict-v1/00.json').then(response => response.ok))).toBe(true);
    const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat());
    expect(cached.filter(url => /supabase\.co|\/(?:auth|rest|functions)\/|[?&](?:code|access_token|refresh_token|date)=/.test(url))).toEqual([]);
    await open(page); await expect(page.locator('[data-offline-info]')).toContainText('目前離線');
    await page.screenshot({ path: info.outputPath(`offline-${profile.name.split(' ')[0]}.png`) });
  });
});

test('waiting updates preserve drafts, refuse another open tab and activate only after an explicit click', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page); await page.goto(base + 'index.html?date=' + day);
  await page.locator('#notes').fill('更新前最後草稿');
  const second = await context.newPage(); await second.goto(base + 'privacy.html');
  await updateReady(page);
  await page.locator('[data-app-close]').click();
  await showMobileSection(page, 'date');
  await expect(page.locator('.site-app-update')).toBeVisible();
  await page.locator('.site-app-update button').click();
  await expect(page.locator('#siteAppDialog')).toBeVisible();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
  await page.locator('[data-offline-update]').click();
  await expect(page.locator('[data-app-status]')).toContainText('其他分頁');
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then(reg => reg?.waiting?.state))).toBe('installed');
  expect(await notes(page)).toBe('更新前最後草稿');
  await second.close();
  await page.locator('[data-offline-update]').click();
  await expect(page.locator('#siteAppDialog')).not.toBeVisible();
  await expect(page.locator('#notes')).toHaveValue('更新前最後草稿');
  await open(page); await expect(page.locator('[data-app-latest-version]')).toHaveText('v171.6.next');
  const snapshot = await page.evaluate(() => new Promise<{ content: string }>((resolve, reject) => {
    const request = indexedDB.open('gsat-study-tracker-record-backups', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result, tx = database.transaction('snapshots', 'readonly');
      const read = tx.objectStore('snapshots').get('study-v11:guest:latest');
      read.onsuccess = () => resolve(read.result);
      tx.oncomplete = () => database.close(); tx.onerror = () => reject(tx.error);
    };
  }));
  const entries = JSON.parse(snapshot.content).entries as { key: string; raw: string }[];
  const copy = entries.find(entry => entry.key === prefix + day);
  expect(copy).toBeDefined();
  const decoded = decodeStudyRecord(copy!.raw, day);
  expect(decoded.ok).toBe(true);
  if (decoded.ok) expect(decoded.record.notes).toBe('更新前最後草稿');
});

test('an offline running timer resumes from elapsed wall time across navigation and reload', async ({ page, context, browserName }) => {
  await prepare(page); await page.goto(base + 'index.html?date=' + day);
  await page.selectOption('#itemType', 'extra'); await page.locator('#addItemBtn').click();
  const card = page.locator('#itemList [data-item]').filter({ has: page.locator('[data-action="delete-item"]') }).last();
  const item = await card.getAttribute('data-item');
  await card.locator('[data-action="time-mode-select"][data-time-mode="timer"]').click();
  await card.locator('[data-action="timer-toggle"]').click();
  await expect(card.locator('[data-action="timer-toggle"]')).toHaveText('暫停');
  await goOffline(page, context, browserName);
  await page.goto(base + 'privacy.html');
  // Fixed time changes model time spent with a suspended page; no timer ticks are needed.
  await page.clock.setFixedTime(new Date('2026-11-18T12:02:05+08:00'));
  await page.goto(base + 'index.html?date=' + day);
  const restored = page.locator(`[data-item="${item}"]`);
  await expect(restored.locator('[data-timer-display]')).toHaveText('02:05');
  await restored.locator('[data-action="timer-toggle"]').click();
  await page.reload();
  await expect(restored.locator('[data-action="timer-toggle"]')).toHaveText('繼續');
  await expect(restored.locator('[data-timer-display]')).toHaveText('02:05');
});

test('an incomplete new deployment leaves the old release and offline records usable', async ({ page, context, browserName }, info) => {
  await prepare(page); await open(page);
  release = { ...release, id: release.id + '-broken', version: 'broken' }; broken = true; slowCleanup = true;
  await page.locator('[data-offline-check]').click();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
  await expect(page.locator('[data-offline-info]')).toHaveAttribute('data-error', 'true');
  await expect(page.locator('[data-offline-check]')).not.toHaveAttribute('data-offline-success');
  const cacheNames = await page.evaluate(() => caches.keys());
  if (cacheNames.includes('gsat-offline:/app/:release:' + release.id)) {
    const details = await page.evaluate(async base => {
      const registration = await navigator.serviceWorker.getRegistration(base);
      const status = await (await caches.open('gsat-offline:/app/:status')).match(new URL('offline-install-status.json', base).href);
      return { status: status ? await status.json() : null, message: document.querySelector('[data-offline-info]')?.textContent,
        workers: { active: registration?.active?.state, installing: registration?.installing?.state, waiting: registration?.waiting?.state } };
    }, base);
    await info.attach('failed-install-cache-state', { body: JSON.stringify({ cacheNames, ...details, workerRequests }), contentType: 'application/json' });
  }
  expect(cacheNames).not.toContain('gsat-offline:/app/:release:' + release.id);
  await goOffline(page, context, browserName); await page.goto(base + 'todo.html');
  await expect(page.locator('#siteAppDialog')).toHaveCount(1);
  await page.goto(base + 'index.html?date=' + day); await expect(page.locator('#notes')).toHaveValue('離線前筆記');
});

test('a backup failure cannot activate a waiting update or erase records', async ({ page }) => {
  await prepare(page); await page.goto(base + 'index.html?date=' + day); await updateReady(page);
  await page.evaluate(() => {
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(stores, mode, options) {
      const tx = transaction.call(this, stores, mode, options);
      if (this.name === 'gsat-study-tracker-record-backups' && mode === 'readwrite' && String(stores).includes('snapshots')) tx.abort();
      return tx;
    };
  });
  await page.locator('[data-offline-update]').click();
  await expect(page.locator('[data-app-status]')).toContainText('備份');
  await expect(page.locator('[data-offline-update]')).toBeVisible();
  expect(await notes(page)).toBe('離線前筆記');
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then(reg => Boolean(reg?.waiting)))).toBe(true);
});

test('unfinished vocabulary editors block an update without discarding the editor', async ({ page }) => {
  await prepare(page); await page.goto(base + 'vocabulary.review.html');
  await page.getByRole('button', { name: '編輯「ability」', exact: true }).click();
  await updateReady(page); await page.locator('[data-offline-update]').click();
  await expect(page.locator('[data-app-status]')).toContainText('單字編輯尚未結束');
  await expect(page.locator('[data-offline-update]')).toBeVisible();
  await page.locator('[data-app-close]').click();
  await expect(page.locator('[data-vocabulary-text]')).toHaveValue('ability');
});

test('CDN-injected HTML still prepares exact offline pages with original security headers', async ({ page, context, request, browserName }) => {
  transformHtml = true;
  expect(await (await request.get(base + 'index.html')).text()).toContain('__CF$cv$params');
  const audit = await promisify(execFile)(process.execPath, ['--experimental-strip-types', 'scripts/checkLiveAppRelease.ts', base], { timeout: 20000 });
  expect(audit.stdout).toContain('0 failed');
  await prepare(page); await goOffline(page, context, browserName);
  await page.goto(base + 'index.html?date=' + day);
  await expect(page.locator('#notes')).toHaveValue('離線前筆記');
  expect(await page.content()).not.toContain('test-injected');
  const headers = await page.evaluate(async () => {
    for (const key of await caches.keys()) {
      if (!key.includes(':release:')) continue;
      const response = await (await caches.open(key)).match(new URL('./index.html', location.href).href);
      if (response) return { csp: response.headers.get('Content-Security-Policy'), frame: response.headers.get('X-Frame-Options') };
    }
  });
  expect(headers?.csp).toContain("frame-ancestors 'none'"); expect(headers?.frame).toBe('DENY');
});

test('missing offline copies identify the file and HTTP status and can be retried without clearing records', async ({ page }) => {
  missingPayload = true;
  await open(page); await page.locator('[data-offline-prepare]').click();
  await expect(page.locator('[data-offline-info]')).toContainText('index.html');
  await expect(page.locator('[data-offline-info]')).toContainText('HTTP 404');
  await expect(page.locator('[data-offline-info]')).not.toContainText('容量不足');
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
  await expect(page.locator('[data-offline-prepare]')).not.toHaveAttribute('data-offline-success');
  expect(await notes(page)).toBe('離線前筆記');
  missingPayload = false; await page.locator('[data-offline-prepare]').click();
  await expect(page.locator('[data-offline-info]')).toBeHidden();
  await expect(page.locator('[data-offline-prepare]')).toHaveAttribute('data-offline-success', 'true');
});

test('cache quota failures report capacity specifically and preserve the primary record', async ({ page }) => {
  cacheQuota = true;
  await open(page); await page.locator('[data-offline-prepare]').click();
  await expect(page.locator('[data-offline-info]')).toContainText('容量不足');
  await expect(page.locator('[data-offline-info]')).not.toContainText('核對碼不符');
  await expect(page.locator('[data-offline-prepare]')).not.toHaveAttribute('data-offline-success');
  expect(await notes(page)).toBe('離線前筆記');
});
