import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { showMobileSection } from './helpers/siteNavigation.ts';
import { decodeStudyRecord } from '../src/storage/studyRecordCodec.ts';
import { markRecordSynced } from '../src/storage/recordSync.ts';

test.use({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
const prefix = 'study-v11:guest:', activeKey = 'study-v11:meta:active-record-prefix';
const original = { schemaVersion: 2, date: '2026-11-15', notes: '原紀錄與備份核對'.repeat(800), localDirty: true,
  syncBase: { date: '2026-11-15', items: [], notes: '保留雲端祖先' }, customLegacy: { keep: '完整保留' }, items: [] };
async function seed(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-11-17T12:00:00+08:00'));
  await page.route('https://arxbirgujbrtzhoficdf.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto('/privacy.html');
  await page.evaluate(({ prefix, original, activeKey }) => {
    localStorage.clear(); localStorage.setItem(activeKey, prefix);
    localStorage.setItem(prefix + original.date, JSON.stringify(original));
    localStorage.setItem(prefix + '2026-11-16', JSON.stringify({ date: '2026-11-16', notes: '第二天', items: [] }));
    localStorage.setItem('study-v11:user:other:2026-11-15', JSON.stringify({ date: '2026-11-15', notes: '其他帳號', items: [] }));
    localStorage.setItem('sb-private-auth-token', 'never-export');
  }, { prefix, original, activeKey });
  await expect(page.locator('#siteAppDialog')).toHaveCount(1);
}
async function open(page: Page): Promise<void> {
  await showMobileSection(page, 'tools');
  await page.locator('#siteAppSettings').click();
  await expect(page.locator('#siteAppDialog')).toBeVisible();
  await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
}

test('every installed entry shares one identity and real app icons with explicit offline preparation', async ({ page, request }) => {
  for (const path of ['/', '/todo.html', '/summary.html', '/material.progress.html', '/vocabulary.review.html', '/gpt.prompt.html', '/privacy.html']) {
    await page.goto(path);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest.webmanifest');
    await expect(page.locator('#siteAppDialog')).toHaveCount(1);
    await expect(page.locator('#siteAppSettings')).toHaveCount(1);
  }
  const response = await request.get('/manifest.webmanifest'); expect(response.ok()).toBe(true);
  const manifest = await response.json(); expect(manifest.display).toBe('standalone'); expect(manifest.id).toBe('./');
  for (const icon of manifest.icons) expect((await request.get('/' + icon.src)).ok()).toBe(true);
  await open(page);
  await expect(page.locator('#siteAppDialog')).toContainText('完成離線準備後');
  await expect(page.locator('[data-offline-info]')).toContainText('尚未準備離線頁面');
});

test('install prompts require a verified backup, use the click activation, and preserve account-specific source data', async ({ page }, info) => {
  await seed(page);
  await page.evaluate(() => {
    const probe = window as unknown as { appPromptCalls: number }; probe.appPromptCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => { probe.appPromptCalls++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await open(page);
  const install = page.locator('[data-app-install]'); await expect(install).toBeDisabled();
  await page.getByRole('button', { name: '備份並整理', exact: true }).click();
  await expect(page.locator('[data-app-status]')).toContainText('裝置備份已完成核對');
  await expect(install).toBeEnabled();
  await expect(page.locator('[data-app-backup-info]')).toContainText('2 天');
  const raw = await page.evaluate(prefix => localStorage.getItem(prefix + '2026-11-15')!, prefix);
  expect(raw.length).toBeLessThan(JSON.stringify(original).length / 2);
  const decoded = decodeStudyRecord(raw, original.date); expect(decoded.ok).toBe(true);
  if (decoded.ok) { expect(decoded.record.notes).toBe(original.notes); expect(decoded.record.syncBase).toEqual(original.syncBase); expect(Reflect.get(decoded.record, 'customLegacy')).toEqual(original.customLegacy); }
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '下載備份', exact: true }).click();
  const snapshot = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(snapshot.entries).toHaveLength(2);
  expect(snapshot.records).toHaveLength(2);
  const exported = decodeStudyRecord(snapshot.entries[0].raw, original.date);
  expect(exported.ok).toBe(true); if (exported.ok) expect(exported.record.notes).toBe(original.notes);
  expect(JSON.stringify(snapshot)).not.toContain('never-export'); expect(JSON.stringify(snapshot)).not.toContain('其他帳號');
  await page.screenshot({ path: info.outputPath('app-install-and-backup-mobile.png') });
  await install.click(); await expect.poll(() => page.evaluate(() => (window as unknown as { appPromptCalls: number }).appPromptCalls)).toBe(1);
  await expect(page.locator('[data-app-status]')).toContainText('已取消安裝');
});

test('IndexedDB recovery survives reload and only restores missing days', async ({ page }) => {
  await seed(page); await open(page);
  await page.getByRole('button', { name: '備份並整理', exact: true }).click();
  await expect(page.locator('[data-app-status]')).toContainText('完成核對');
  await page.locator('[data-app-close]').click();
  await page.evaluate(prefix => {
    localStorage.removeItem(prefix + '2026-11-15');
    localStorage.setItem(prefix + '2026-11-16', JSON.stringify({ date: '2026-11-16', items: [], notes: '新的內容' }));
  }, prefix);
  await page.reload(); await open(page);
  await page.locator('[data-app-recovery] summary').click();
  await expect(page.locator('[data-app-missing]')).toContainText('2026-11-15');
  await page.getByRole('button', { name: '確認還原缺少紀錄', exact: true }).click();
  await expect(page.locator('[data-app-status]')).toContainText('已還原 1 天；保留現有 1 天');
  const saved = await page.evaluate(prefix => [localStorage.getItem(prefix + '2026-11-15'), localStorage.getItem(prefix + '2026-11-16')], prefix);
  const restored = decodeStudyRecord(saved[0]!, original.date); expect(restored.ok).toBe(true);
  if (restored.ok) expect(restored.record).toEqual(original);
  expect(JSON.parse(saved[1]!).notes).toBe('新的內容');
});

test('a JSON backup transfers guest records into a clean browser container after preview', async ({ page, browser }) => {
  await seed(page); await open(page); await page.getByRole('button', { name: '備份並整理', exact: true }).click();
  await expect(page.locator('[data-app-status]')).toContainText('完成核對');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '下載備份', exact: true }).click();
  const content = await readFile((await (await pending).path())!);
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  try {
    const fresh = await context.newPage(); await fresh.goto('http://127.0.0.1:4173/privacy.html'); await open(fresh);
    await fresh.evaluate(() => {
      const probe = window as unknown as { simulatePrimaryFull: boolean }; probe.simulatePrimaryFull = true;
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (probe.simulatePrimaryFull && key === 'study-v11:guest:2026-11-15') throw new DOMException('full', 'QuotaExceededError');
        return set.call(this, key, value);
      };
    });
    await fresh.locator('[data-app-file]').setInputFiles({ name: 'GSAT-backup.json', mimeType: 'application/json', buffer: content });
    await expect(fresh.locator('[data-app-status]')).toContainText('備份已核對');
    expect(await fresh.evaluate(() => localStorage.getItem('study-v11:guest:2026-11-15'))).toBeNull();
    await fresh.locator('[data-app-recovery] summary').click();
    await fresh.getByRole('button', { name: '確認還原缺少紀錄', exact: true }).click();
    await expect(fresh.locator('[data-app-status]')).toContainText('已還原 1 天');
    await expect(fresh.locator('[data-app-status]')).toContainText('1 天未寫入');
    await expect(fresh.locator('[data-app-missing]')).toContainText('2026-11-15');
    await fresh.evaluate(() => { (window as unknown as { simulatePrimaryFull: boolean }).simulatePrimaryFull = false; });
    await fresh.getByRole('button', { name: '確認還原缺少紀錄', exact: true }).click();
    await expect(fresh.locator('[data-app-status]')).toContainText('已還原 1 天；保留現有 1 天');
    const restored = decodeStudyRecord(await fresh.evaluate(() => localStorage.getItem('study-v11:guest:2026-11-15')!), original.date);
    expect(restored.ok).toBe(true); if (restored.ok) expect((restored.record.notes ?? '').length).toBe(original.notes.length);
  } finally { await context.close(); }
});

test('a blocked backup leaves primary records untouched and does not enable installation', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(name, version) {
      if (name === 'gsat-study-tracker-record-backups') throw new DOMException('blocked', 'QuotaExceededError');
      return original.call(this, name, version);
    };
  });
  await seed(page); const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  await open(page); await expect(page.locator('[data-app-status]')).toContainText('裝置備份無法寫入');
  await page.getByRole('button', { name: '備份並整理', exact: true }).click();
  await expect(page.locator('[data-app-status]')).toContainText('裝置備份無法寫入');
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(before);
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '下載備份', exact: true }).click();
  const snapshot = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(snapshot.entries).toHaveLength(2); expect(snapshot.records).toHaveLength(2);
  await page.locator('[data-app-close]').click(); await expect(page.locator('#siteAppDialog')).not.toBeVisible();
});

test('standalone mode keeps backup tools available and hides install actions', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await seed(page); await open(page);
  await expect(page.locator('[data-app-instructions]')).toContainText('App 視窗');
  await expect(page.locator('[data-app-install]')).not.toBeVisible();
  await expect(page.getByRole('button', { name: '備份並整理', exact: true })).toBeVisible();
  expect(await page.locator('#siteAppDialog').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test('iPhone guidance uses the share menu rather than pretending to support a browser install prompt', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { value: 'iPhone Safari' }));
  await seed(page); await open(page);
  await expect(page.locator('[data-app-instructions]')).toContainText('分享');
  await expect(page.locator('[data-app-instructions]')).toContainText('加入主畫面');
  await expect(page.locator('[data-app-install]')).not.toBeVisible();
});

test('an account switch while the panel is open prevents restoring the previous account backup', async ({ page }) => {
  await seed(page); await open(page); await page.getByRole('button', { name: '備份並整理', exact: true }).click();
  await expect(page.locator('[data-app-status]')).toContainText('完成核對');
  await page.locator('[data-app-close]').click();
  await page.evaluate(prefix => localStorage.removeItem(prefix + '2026-11-15'), prefix);
  await open(page); await page.locator('[data-app-recovery] summary').click();
  await expect(page.locator('[data-app-missing]')).toContainText('2026-11-15');
  await page.evaluate(activeKey => {
    localStorage.setItem(activeKey, 'study-v11:user:another:');
    window.dispatchEvent(new StorageEvent('storage', { key: activeKey, storageArea: localStorage }));
  }, activeKey);
  await expect(page.locator('[data-app-backup-info]')).toHaveText('');
  await expect(page.locator('[data-app-missing]')).toHaveText('');
  await page.getByRole('button', { name: '備份並整理', exact: true }).click();
  await expect(page.locator('[data-app-status]')).toContainText('帳號已變更');
  expect(await page.evaluate(() => localStorage.getItem('study-v11:user:another:2026-11-15'))).toBeNull();
});

test('a full primary store can back up and reclaim space before retrying the unsaved Tracker draft', async ({ page }) => {
  await seed(page); await page.goto('/index.html?date=2026-11-15');
  await expect.poll(() => page.locator('#notes').inputValue().then(value => value.length)).toBe(original.notes.length);
  await page.evaluate(() => {
    const probe = window as unknown as { verifiedDeviceBackup: boolean }; probe.verifiedDeviceBackup = false;
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(stores, mode, options) {
      const tx = transaction.call(this, stores, mode, options);
      if (this.name === 'gsat-study-tracker-record-backups' && mode === 'readonly' && String(stores).includes('snapshots')) {
        tx.addEventListener('complete', () => { probe.verifiedDeviceBackup = true; });
      }
      return tx;
    };
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('study-v11:guest:') && /\d{4}-\d{2}-\d{2}$/.test(key) && !probe.verifiedDeviceBackup) throw new DOMException('full', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.locator('#notes').fill('空間恢復後要保存的草稿'); await page.locator('#notes').blur();
  if (await page.locator('[data-save-failure-close]').isVisible()) await page.locator('[data-save-failure-close]').click();
  await open(page); await page.getByRole('button', { name: '備份並整理', exact: true }).click();
  await expect(page.locator('[data-app-status]')).toContainText('裝置備份已完成核對');
  const raw = await page.evaluate(prefix => localStorage.getItem(prefix + '2026-11-15')!, prefix);
  const decoded = decodeStudyRecord(raw, original.date); expect(decoded.ok).toBe(true);
  if (decoded.ok) expect(decoded.record.notes).toBe('空間恢復後要保存的草稿');
});

test('an install prompt fired before the shared shell finishes loading remains available', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/site-shell.js', async route => { await gate; await route.continue(); });
  await page.goto('/privacy.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  release(); await expect(page.locator('#siteAppDialog')).toHaveCount(1); await open(page);
  await expect(page.locator('[data-app-install]')).toBeVisible();
  await page.getByRole('button', { name: '備份並整理', exact: true }).click();
  await expect(page.locator('[data-app-install]')).toBeEnabled();
});

const accountId = '00000000-0000-0000-0000-000000000189';
const accountPrefix = `study-v11:user:${accountId}:`;
const authKey = 'sb-arxbirgujbrtzhoficdf-auth-token';
async function accountSeed(page: Page, options: { pending?: boolean; tombstone?: boolean; expires?: boolean } = {}): Promise<void> {
  await seed(page);
  const saved = markRecordSynced({ ...original, serverRevision: 7 });
  if (options.pending) saved.localDirty = true;
  await page.evaluate(async ({ accountPrefix, accountId, authKey, activeKey, saved, options }) => {
    localStorage.setItem(activeKey, accountPrefix);
    localStorage.setItem(accountPrefix + saved.date, JSON.stringify(saved));
    const session = JSON.stringify({ access_token: 'test-account-install-token', user: { id: accountId },
      expires_at: Math.floor(Date.now() / 1000) + (options.expires ? -60 : 3600) });
    localStorage.setItem(authKey, session);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('gsat-study-tracker-auth', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('sessions'); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').put({ value: options.tombstone ? null : session }, authKey);
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
    const probe = window as unknown as { appPromptCalls: number }; probe.appPromptCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => { probe.appPromptCalls++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  }, { accountPrefix, accountId, authKey, activeKey, saved, options });
}

test('synced account records are automatically backed up and directly installable without compaction or extra network requests', async ({ page }, info) => {
  await accountSeed(page);
  let requests = 0; page.on('request', request => { if (request.url().includes('.supabase.co/')) requests++; });
  const before = await page.evaluate(key => localStorage.getItem(key), accountPrefix + original.date);
  await open(page);
  await expect(page.locator('[data-app-install]')).toBeEnabled();
  await expect(page.locator('[data-app-instructions]')).toContainText('自動核對');
  await expect(page.locator('[data-app-status]')).toContainText('可直接安裝');
  await expect(page.locator('[data-app-backup-info]')).toContainText('1 天');
  expect(await page.evaluate(key => localStorage.getItem(key), accountPrefix + original.date)).toBe(before);
  expect(requests).toBe(0);
  await page.screenshot({ path: info.outputPath('account-automatic-install-backup.png') });
  await page.locator('[data-app-install]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { appPromptCalls: number }).appPromptCalls)).toBe(1);
});

for (const condition of ['pending', 'tombstone', 'expires'] as const) test(`an account with ${condition} retains the manual requirement instead of claiming automatic backup`, async ({ page }) => {
  await accountSeed(page, { [condition]: true }); await open(page);
  await expect(page.locator('[data-app-install]')).toBeDisabled();
  await expect(page.locator('[data-app-status]')).not.toContainText('自動完成核對');
  await page.getByRole('button', { name: '備份並整理', exact: true }).click();
  await expect(page.locator('[data-app-install]')).toBeEnabled();
});

test('new unsynced edits revoke automatic readiness and a later confirmed save automatically backs up again', async ({ page }) => {
  await accountSeed(page); await open(page); await expect(page.locator('[data-app-install]')).toBeEnabled();
  const next = markRecordSynced({ ...original, notes: '稍後完成同步的新內容', serverRevision: 8 });
  await page.evaluate(({ key, next }) => {
    localStorage.setItem(key, JSON.stringify({ ...next, localDirty: true }));
    window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
  }, { key: accountPrefix + original.date, next });
  await expect(page.locator('[data-app-install]')).toBeDisabled();
  await page.evaluate(({ key, next }) => {
    localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event('study-records-changed'));
  }, { key: accountPrefix + original.date, next });
  await expect(page.locator('[data-app-install]')).toBeEnabled();
  await expect(page.locator('[data-app-status]')).toContainText('自動完成核對');
  const pending = page.waitForEvent('download'); await page.locator('[data-app-export]').click();
  const exported = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(exported.records).toHaveLength(1); expect(exported.records[0].notes).toBe(next.notes);
});

test('a failed automatic backup never enables install or requests a manual click as a completed backup', async ({ page }) => {
  await accountSeed(page);
  await page.evaluate(() => {
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(stores, mode, options) {
      const tx = transaction.call(this, stores, mode, options);
      if (this.name === 'gsat-study-tracker-record-backups' && mode === 'readwrite' && String(stores).includes('snapshots')) tx.abort();
      return tx;
    };
  });
  await open(page);
  await expect(page.locator('[data-app-status]')).toContainText('裝置備份無法寫入');
  await expect(page.locator('[data-app-install]')).toBeDisabled();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).notes, accountPrefix + original.date)).toBe(original.notes);
});
