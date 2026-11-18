import { test, expect, type Page } from '@playwright/test';
import { showMobileSection } from './helpers/siteNavigation.ts';

test.use({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
const prefix = 'study-v11:guest:', activeKey = 'study-v11:meta:active-record-prefix';
const original = { schemaVersion: 2, date: '2026-11-15', notes: '保留原紀錄'.repeat(800), localDirty: true,
  syncBase: { date: '2026-11-15', items: [], notes: '保留雲端祖先' }, customLegacy: { keep: '完整保留' }, items: [] };
async function seed(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-11-17T12:00:00+08:00'));
  await page.route('https://arxbirgujbrtzhoficdf.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto('/privacy.html');
  await page.evaluate(({ prefix, original, activeKey }) => {
    localStorage.clear(); localStorage.setItem(activeKey, prefix);
    localStorage.setItem(prefix + original.date, JSON.stringify(original));
    localStorage.setItem('study-v11:user:other:2026-11-15', JSON.stringify({ date: '2026-11-15', notes: '其他帳號', items: [] }));
  }, { prefix, original, activeKey });
  await expect(page.locator('#siteAppDialog')).toHaveCount(1);
}
async function open(page: Page): Promise<void> {
  await showMobileSection(page, 'tools');
  await page.locator('#siteAppSettings').click();
  await expect(page.getByRole('dialog', { name: '安裝與更新', exact: true })).toBeVisible();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
}
async function offerInstall(page: Page, outcome: 'accepted' | 'dismissed' | 'failed' | 'throws' = 'dismissed'): Promise<void> {
  await page.evaluate(outcome => {
    const probe = window as unknown as { installCalls: number; installActive: boolean };
    probe.installCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: () => {
      probe.installCalls++; probe.installActive = navigator.userActivation?.isActive ?? true;
      if (outcome === 'throws') throw new Error('browser rejected synchronously');
      return outcome === 'failed' ? Promise.reject(new Error('browser rejected')) : Promise.resolve();
    }, userChoice: Promise.resolve({ outcome }) });
    window.dispatchEvent(event);
  }, outcome);
}

test('every entry shares the app identity and opens simplified install and offline settings', async ({ page, request }) => {
  for (const path of ['/', '/todo.html', '/summary.html', '/material.progress.html', '/vocabulary.review.html', '/gpt.prompt.html', '/privacy.html']) {
    await page.goto(path);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');
    await expect(page.locator('#siteAppDialog')).toHaveCount(1);
    await expect(page.locator('#siteAppSettings')).toHaveText('安裝與更新');
  }
  const response = await request.get('/manifest.webmanifest'); expect(response.ok()).toBe(true);
  const manifest = await response.json(); expect(manifest.display).toBe('standalone'); expect(manifest.id).toBe('./');
  for (const icon of manifest.icons) expect((await request.get('/' + icon.src)).ok()).toBe(true);
  await open(page);
  await expect(page.locator('[data-offline-info]')).toContainText('尚未準備離線頁面');
  await expect(page.getByRole('button', { name: '準備離線使用', exact: true })).toBeVisible();
});

test('opening settings does not scan records, inspect capacity or create a backup, even when storage is unavailable', async ({ page }, info) => {
  await seed(page); await offerInstall(page); await showMobileSection(page, 'tools');
  const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  await page.evaluate(() => {
    Storage.prototype.key = () => { throw new Error('unexpected record scan'); };
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    const idbOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(name, version) {
      if (name === 'gsat-study-tracker-record-backups') throw new Error('unexpected backup');
      return idbOpen.call(this, name, version);
    };
    Object.defineProperty(navigator.storage, 'estimate', { value: () => { throw new Error('unexpected capacity check'); } });
    Object.defineProperty(navigator.storage, 'persisted', { value: () => { throw new Error('unexpected persistence check'); } });
  });
  await page.locator('#siteAppSettings').click();
  await expect(page.locator('#siteAppDialog')).toBeVisible();
  await expect(page.locator('[data-app-install]')).toBeEnabled();
  await expect(page.locator('#siteAppDialog')).not.toContainText('裝置備份');
  await expect(page.locator('#siteAppDialog')).not.toContainText('容量');
  await expect(page.locator('[data-app-status]')).toHaveText('');
  await expect(page.locator('[data-app-backup], [data-app-export], [data-app-import], [data-app-persist], [data-app-file], [data-app-recovery]')).toHaveCount(0);
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.locator('#siteAppDialog').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`simple-app-settings-${width}.png`) });
  }
  await page.locator('[data-app-install]').click();
  await expect(page.locator('[data-app-status]')).toContainText('已取消安裝');
  expect(await page.evaluate(() => (window as unknown as { installCalls: number }).installCalls)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { installActive: boolean }).installActive)).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(before);
});

test('pending account records and an account change do not block installation or rewrite records', async ({ page }) => {
  await seed(page); await offerInstall(page);
  await page.evaluate(({ prefix, activeKey, original }) => {
    const accountPrefix = 'study-v11:user:pending:';
    localStorage.setItem(activeKey, accountPrefix);
    localStorage.setItem(accountPrefix + original.date, localStorage.getItem(prefix + original.date)!);
  }, { prefix, activeKey, original });
  const before = await page.evaluate(() => localStorage.getItem('study-v11:user:pending:2026-11-15'));
  await open(page); await expect(page.locator('[data-app-install]')).toBeEnabled();
  await page.evaluate(activeKey => {
    localStorage.setItem(activeKey, 'study-v11:guest:');
    window.dispatchEvent(new StorageEvent('storage', { key: activeKey, storageArea: localStorage }));
  }, activeKey);
  await page.locator('[data-app-install]').click();
  await expect(page.locator('[data-app-status]')).toContainText('已取消安裝');
  expect(await page.evaluate(() => localStorage.getItem('study-v11:user:pending:2026-11-15'))).toBe(before);
});

test('standalone mode hides installation and retains offline and update controls', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await seed(page); await open(page);
  await expect(page.locator('[data-app-instructions]')).toContainText('App 視窗');
  await expect(page.locator('[data-app-install]')).toBeHidden();
  await expect(page.locator('[data-offline-prepare]')).toBeVisible();
  await page.locator('[data-app-close]').click(); await expect(page.locator('#siteAppDialog')).toBeHidden();
});

test('iPhone guidance uses the share menu when no browser install prompt is available', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { value: 'iPhone Safari' }));
  await seed(page); await open(page);
  await expect(page.locator('[data-app-instructions]')).toContainText('分享');
  await expect(page.locator('[data-app-instructions]')).toContainText('加入主畫面');
  await expect(page.locator('[data-app-install]')).toBeHidden();
});

test('a prompt received before async shell hydration is ready without a manual preparation step', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/site-shell.js', async route => { await gate; await route.continue(); });
  await page.goto('/privacy.html', { waitUntil: 'domcontentloaded' }); await offerInstall(page);
  release(); await expect(page.locator('#siteAppDialog')).toHaveCount(1); await open(page);
  await expect(page.locator('[data-app-install]')).toBeEnabled();
});

test('completed installation stays hidden when the panel is reopened', async ({ page }) => {
  await seed(page); await offerInstall(page, 'accepted'); await open(page);
  await page.locator('[data-app-install]').click();
  await expect(page.locator('[data-app-status]')).toContainText('已接受安裝');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('[data-app-status]')).toHaveText('App 已安裝。');
  await page.locator('[data-app-close]').click(); await open(page);
  await expect(page.locator('[data-app-install]')).toBeHidden();
});

for (const failure of ['failed', 'throws'] as const) test(`a ${failure} browser install can be retried with a new prompt and leaves records intact`, async ({ page }) => {
  await seed(page); await offerInstall(page, failure); await open(page);
  const before = await page.evaluate(prefix => localStorage.getItem(prefix + '2026-11-15'), prefix);
  await page.locator('[data-app-install]').click();
  await expect(page.locator('[data-app-status]')).toContainText('瀏覽器未完成安裝');
  await offerInstall(page); await expect(page.locator('[data-app-install]')).toBeEnabled();
  await page.locator('[data-app-install]').click();
  await expect(page.locator('[data-app-status]')).toContainText('已取消安裝');
  expect(await page.evaluate(prefix => localStorage.getItem(prefix + '2026-11-15'), prefix)).toBe(before);
});
