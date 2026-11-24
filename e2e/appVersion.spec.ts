import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { showMobileSection } from './helpers/siteNavigation.ts';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
test.use({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
async function open(page: Page): Promise<void> {
  await showMobileSection(page, 'tools');
  await page.locator('#siteAppSettings').click();
  await expect(page.locator('#siteAppDialog')).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await page.route('https://arxbirgujbrtzhoficdf.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto('/privacy.html');
});

test('opening settings reports the loaded version and a newer deployed version without preparing offline files or changing records', async ({ page }, info) => {
  let requests = 0;
  await page.route('**/app-release.json', route => {
    requests++; return route.fulfill({ json: { version: '171.6.next' } });
  });
  const before = await page.evaluate(() => {
    localStorage.setItem('study-v11:guest:2026-11-24', JSON.stringify({ date: '2026-11-24', items: [], notes: '版本查詢保留' }));
    return JSON.stringify(Object.entries(localStorage));
  });
  expect(requests).toBe(0);
  await open(page);
  await expect(page.locator('[data-app-current-version]')).toHaveText(`v${version}`);
  await expect(page.locator('[data-app-latest-version]')).toHaveText('v171.6.next');
  await expect(page.locator('[data-offline-info]')).toBeHidden();
  await expect(page.locator('#siteAppDialog')).not.toContainText('ECDICT');
  expect(requests).toBe(1);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(items => items.length))).toBe(0);
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))).toBe(before);
  const size = await page.locator('#siteAppDialog').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width);
  await page.screenshot({ path: info.outputPath('app-versions-mobile.png') });
});

test('a slow version lookup is shared with preparation and does not delay verified green feedback', async ({ page }) => {
  test.setTimeout(45000);
  let release!: () => void, requests = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/app-release.json', async route => {
    requests++; await held; await route.fulfill({ json: { version } });
  });
  try {
    await open(page);
    await expect(page.locator('[data-app-latest-version]')).toHaveText('檢查中…');
    await page.locator('[data-offline-prepare]').click();
    await expect(page.locator('[data-offline-prepare]')).toHaveAttribute('data-offline-success', 'true');
    await expect(page.locator('#siteAppDialog')).not.toHaveAttribute('aria-busy');
    await expect(page.locator('[data-app-latest-version]')).toHaveText('檢查中…');
    expect(requests).toBe(1);
    release();
    await expect(page.locator('[data-app-latest-version]')).toHaveText(`v${version}`);
  } finally { release(); }
});

test('invalid or unavailable release metadata never claims the app is current and reconnecting retries the lookup', async ({ page, context }) => {
  let state: 'invalid' | 'unavailable' | 'ready' = 'invalid', requests = 0;
  await page.route('**/app-release.json', route => {
    requests++;
    return state === 'unavailable' ? route.fulfill({ status: 503 })
      : route.fulfill({ json: { version: state === 'ready' ? '171.6.next' : '<invalid>' } });
  });
  await open(page);
  await expect(page.locator('[data-app-latest-version]')).toHaveText('無法確認');
  await expect(page.locator('[data-app-current-version]')).toHaveText(`v${version}`);
  await page.locator('[data-app-close]').click(); state = 'unavailable'; await open(page);
  await expect(page.locator('[data-app-latest-version]')).toHaveText('無法確認');
  expect(requests).toBe(2);
  await context.setOffline(true);
  await expect(page.locator('[data-app-latest-version]')).toHaveText('離線，無法確認');
  state = 'ready'; await context.setOffline(false);
  await expect(page.locator('[data-app-latest-version]')).toHaveText('v171.6.next');
  await expect(page.locator('[data-app-current-version]')).toHaveText(`v${version}`);
  await expect(page.locator('#siteAppDialog')).not.toContainText('已是最新版本');
  expect(requests).toBe(3);
});
