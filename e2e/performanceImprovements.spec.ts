import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { expandTodoCard } from './helpers/todoCard.ts';

test.use({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', timezoneId: 'Asia/Taipei' });
const prefix = 'study-v11:guest:';
async function seed(page: Page, words = 1000): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00+08:00'));
  await page.route('https://arxbirgujbrtzhoficdf.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto('/privacy.html');
  await page.evaluate(({ prefix, words }) => {
    localStorage.clear(); localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    for (let offset = 0; offset < Math.ceil(words / 25); offset++) {
      const date = new Date(Date.UTC(2026, 10, 4 - offset)).toISOString().slice(0, 10);
      const values = Array.from({ length: Math.min(25, words - offset * 25) }, (_, index) => {
        const number = offset * 25 + index;
        let value = number, suffix = '';
        do { suffix = String.fromCharCode(97 + value % 26) + suffix; value = Math.floor(value / 26) - 1; } while (value >= 0);
        return { id: `word-${number}`, text: number === words - 1 ? 'zzzauditlast' : 'audit' + suffix, noun: true,
          gsatLevel: 3, showGsatLevel: true, translationsByPartOfSpeech: { noun: ['測試翻譯'] } };
      });
      localStorage.setItem(prefix + date, JSON.stringify({ schemaVersion: 2, date, notes: '保留原筆記', items: [
        { id: 'words', type: 'englishVocabInteractive', source: 'custom', required: false, done: false, minutes: '20', f: { words: values } },
      ] }));
    }
  }, { prefix, words });
}

test('a thousand words render in batches while complete search, grouped views, edits and DOCX export remain intact', async ({ page }, testInfo) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true }); });
  await seed(page);
  const coreRequests: string[] = [];
  page.on('request', request => { if (/ceecCoreMeanings-/.test(request.url())) coreRequests.push(request.url()); });
  const started = performance.now();
  await page.goto('/vocabulary.review.html');
  await expect(page.locator('.vocabulary-row')).toHaveCount(60);
  await expect(page.locator('#visibleVocabularyCount')).toHaveText('1000 個');
  const nodes = await page.locator('*').count();
  expect(nodes).toBeLessThan(3000);
  expect(coreRequests).toHaveLength(0);
  console.log('LARGE_VOCABULARY_READY', JSON.stringify({ total: 1000, mounted: 60, nodes, readyMs: Math.round(performance.now() - started) }));
  await page.screenshot({ path: testInfo.outputPath('large-vocabulary-first-batch.png'), fullPage: false });
  const before = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key]) => /^study-v11:guest:\d/.test(key)))));
  await page.locator('#vocabularyExportFormat').selectOption('docx');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '有翻譯', exact: true }).click();
  const download = await pending;
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  const xml = await zip.file('word/document.xml')!.async('string');
  const exported = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(match => match[1]).filter(text => /^audit[a-z]+$/.test(text) || text === 'zzzauditlast');
  expect(new Set(exported).size).toBe(1000);
  await expect(page.locator('.vocabulary-row')).toHaveCount(60);
  expect(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([key]) => /^study-v11:guest:\d/.test(key)))))).toBe(before);
  await page.getByRole('button', { name: '載入更多', exact: true }).click();
  await expect(page.locator('.vocabulary-row')).toHaveCount(120);
  await page.locator('.vocabulary-load-more').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('vocabulary-load-more-mobile.png'), fullPage: false });
  await page.locator('#vocabularyGrouping [data-grouping-mode="partOfSpeech"]').click();
  await expect(page.locator('.vocabulary-row')).toHaveCount(60);
  await expect(page.locator('#vocabulary-group-noun')).toBeVisible();
  await page.locator('#vocabularyGrouping [data-grouping-mode="gsatLevel"]').click();
  await expect(page.locator('.vocabulary-row')).toHaveCount(60);
  await expect(page.locator('#vocabulary-group-level-3')).toBeVisible();
  await page.locator('#vocabularyGrouping [data-grouping-mode="alphabetical"]').click();
  await page.locator('#vocabularySearch').fill('zzzauditlast');
  const row = page.locator('.vocabulary-row[data-entry-key="zzzauditlast"]');
  await expect(row).toBeVisible();
  await expect(page.locator('#visibleVocabularyCount')).toHaveText('1 個');
  await row.getByRole('button', { name: '編輯「zzzauditlast」', exact: true }).click();
  await row.locator('[data-vocabulary-pos-translation]').fill('尾端單字也能編輯');
  await row.locator('[data-vocabulary-pos-translation]').blur();
  await page.reload();
  await page.locator('#vocabularySearch').fill('zzzauditlast');
  await expect(row).toContainText('尾端單字也能編輯');
});

test('scrolling appends the next batch without replacing mounted controls', async ({ page }) => {
  await seed(page);
  await page.goto('/vocabulary.review.html');
  await expect(page.locator('.vocabulary-row')).toHaveCount(60);
  const first = page.locator('.vocabulary-row').first();
  await first.evaluate(node => { node.setAttribute('data-retained-probe', 'true'); });
  const position = await page.evaluate(() => {
    document.querySelector('.vocabulary-row:last-child')!.setAttribute('data-scroll-probe', 'true');
    document.querySelector('.vocabulary-load-more')!.scrollIntoView();
    return { top: document.querySelector('[data-scroll-probe]')!.getBoundingClientRect().top, y: scrollY };
  });
  await expect(page.locator('.vocabulary-row')).toHaveCount(120);
  await expect(first).toHaveAttribute('data-retained-probe', 'true');
  const after = await page.locator('[data-scroll-probe]').evaluate(node => ({ top: node.getBoundingClientRect().top, y: scrollY }));
  expect(Math.abs(after.top - position.top)).toBeLessThan(1);
  expect(Math.abs(after.y - position.y)).toBeLessThan(1);
  expect(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth)).toBe(true);
});

test('a delayed dictionary result preserves the focused English draft and the following Tab commit', async ({ page }) => {
  await seed(page, 1);
  await page.evaluate(prefix => {
    const key = prefix + '2026-11-04', record = JSON.parse(localStorage.getItem(key)!);
    record.items[0].f.words = [{ id: 'typing', text: 'new-test-word' }];
    localStorage.setItem(key, JSON.stringify(record));
  }, prefix);
  let release!: () => void, requested = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/ceecCoreMeanings-*.json', async route => { requested = true; await gate; await route.continue(); });
  await page.goto('/vocabulary.review.html');
  const original = page.locator('.vocabulary-row[data-entry-key="new-test-word"]');
  await original.getByRole('button', { name: '編輯「new-test-word」', exact: true }).click();
  await original.getByLabel('英文內容').fill('ability');
  await original.getByLabel('英文內容').press('Tab');
  await expect.poll(() => requested).toBe(true);
  const draft = page.locator('.vocabulary-row[data-entry-key="ability"] [data-vocabulary-text]');
  await draft.fill('abandon');
  await draft.evaluate(node => node.setAttribute('data-draft-probe', 'retained'));
  const response = page.waitForResponse('**/ceecCoreMeanings-*.json'); release(); await response;
  await expect.poll(() => page.evaluate(prefix => {
    const record = JSON.parse(localStorage.getItem(prefix + '2026-11-04')!);
    return record.items[0].f.words[0].translationsByPartOfSpeech?.noun?.[0];
  }, prefix)).toBe('能力');
  await expect(draft).toHaveValue('abandon');
  await expect(draft).toHaveAttribute('data-draft-probe', 'retained');
  await draft.press('Tab');
  const edited = page.locator('.vocabulary-row[data-entry-key="abandon"]');
  await expect(edited.getByLabel('Verb', { exact: true })).toBeChecked();
  await expect(edited.getByLabel('Verb 中文翻譯 1', { exact: true })).toHaveValue('放棄');
});

for (const target of [
  { path: '/material.progress.html#natural', source: '#recordSource' },
  { path: '/summary.html', source: '#summarySource' },
  { path: '/todo.html', source: '#recordSource' },
]) test(`${target.path} ignores irrelevant notifications and coalesces current-record bursts`, async ({ page }) => {
  await seed(page, 100);
  await page.goto(target.path);
  await expect(page.locator(target.source)).toContainText('4 天紀錄');
  await page.evaluate(selector => {
    (window as unknown as { auditChanges: number }).auditChanges = 0;
    new MutationObserver(mutations => { (window as unknown as { auditChanges: number }).auditChanges += mutations.length; })
      .observe(document.querySelector(selector)!, { childList: true });
    for (let i = 0; i < 20; i++) window.dispatchEvent(new StorageEvent('storage', { storageArea: localStorage,
      key: 'study-v11:user:other:meta:pending-sync:2026-11-04', newValue: String(i) }));
  }, target.source);
  await page.waitForTimeout(220);
  expect(await page.evaluate(() => (window as unknown as { auditChanges: number }).auditChanges)).toBe(0);
  await page.evaluate(prefix => {
    for (let i = 0; i < 20; i++) {
      const key = prefix + '2026-11-04', record = JSON.parse(localStorage.getItem(key)!);
      record.notes = '最新筆記 ' + i;
      localStorage.setItem(key, JSON.stringify(record));
      window.dispatchEvent(new StorageEvent('storage', { storageArea: localStorage, key, newValue: JSON.stringify(record) }));
    }
  }, prefix);
  await expect.poll(() => page.evaluate(() => (window as unknown as { auditChanges: number }).auditChanges)).toBe(1);
  await page.waitForTimeout(160);
  expect(await page.evaluate(() => (window as unknown as { auditChanges: number }).auditChanges)).toBe(1);
  console.log('COALESCED_RECORD_REFRESH', JSON.stringify({ page: target.path, unrelatedEvents: 20, unrelatedRefreshes: 0, dateEvents: 20, refreshes: 1 }));
  await page.evaluate(() => {
    const account = 'study-v11:user:new:';
    localStorage.setItem(account + '2026-11-04', JSON.stringify({ schemaVersion: 2, date: '2026-11-04', items: [], notes: '另一帳號' }));
    localStorage.setItem('study-v11:meta:active-record-prefix', account);
    window.dispatchEvent(new StorageEvent('storage', { storageArea: localStorage, key: 'study-v11:meta:active-record-prefix', newValue: account }));
  });
  await expect(page.locator(target.source)).toContainText('帳號');
  await expect(page.locator(target.source)).toContainText('1 天紀錄');
});

test('a coalesced background refresh preserves a same-field save conflict until an explicit retry', async ({ page }) => {
  await seed(page, 1);
  await page.evaluate(prefix => {
    const date = '2026-11-04';
    localStorage.setItem(prefix + date, JSON.stringify({ schemaVersion: 2, date, notes: '保留筆記', items: [{
      id: 'conflict', type: 'scienceReview', title: '物理同步衝突', source: 'preset', required: true,
      done: false, minutes: '', f: { subject: '物理', material: '新關鍵', start: '10', end: '12' },
    }] }));
  }, prefix);
  await page.goto('/todo.html');
  await expandTodoCard(page.locator('.todo-card'));
  const minutes = page.locator('[data-todo-minutes]');
  await minutes.fill('27.5');
  await page.evaluate(prefix => {
    const probe = window as unknown as { refreshedAfterConflict: boolean };
    probe.refreshedAfterConflict = false;
    new MutationObserver(() => { probe.refreshedAfterConflict = true; })
      .observe(document.querySelector('#recordSource')!, { childList: true });
    const key = prefix + '2026-11-04', record = JSON.parse(localStorage.getItem(key)!);
    record.items[0].minutes = '15';
    localStorage.setItem(key, JSON.stringify(record));
    window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage, newValue: JSON.stringify(record) }));
    // Blur before the scheduled refresh, matching a user who leaves the field immediately.
    document.querySelector<HTMLInputElement>('[data-todo-minutes]')!.blur();
  }, prefix);
  await expect.poll(() => page.evaluate(() => (window as unknown as { refreshedAfterConflict: boolean }).refreshedAfterConflict)).toBe(true);
  await expect(page.locator('#todoError')).toContainText('同一欄位');
  await expect(page.locator('#todoError')).toContainText('讀書時間（分鐘）');
  await expect(minutes).toHaveValue('27.5');
  expect(await page.evaluate(prefix => JSON.parse(localStorage.getItem(prefix + '2026-11-04')!).items[0].minutes, prefix)).toBe('15');
  await page.locator('#refreshTodo').click();
  await minutes.focus(); await minutes.blur();
  expect(await page.evaluate(prefix => JSON.parse(localStorage.getItem(prefix + '2026-11-04')!).items[0].minutes, prefix)).toBe('27.5');
});

test.describe('desktop progressive vocabulary', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test('two-column cards append and search the complete list while resizing keeps controls inside the page', async ({ page }) => {
    await seed(page);
    await page.goto('/vocabulary.review.html');
    await expect(page.locator('.vocabulary-row')).toHaveCount(60);
    await page.locator('#vocabularySearch').fill('zzzauditlast');
    await expect(page.locator('.vocabulary-row')).toHaveCount(1);
    await expect(page.locator('#visibleVocabularyCount')).toHaveText('1 個');
    await page.locator('#vocabularySearch').fill('');
    await expect(page.locator('.vocabulary-row')).toHaveCount(60);
    await page.locator('.vocabulary-load-more').evaluate(node => node.scrollIntoView());
    await expect(page.locator('.vocabulary-row')).toHaveCount(120);
    expect(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('#visibleVocabularyCount')).toHaveText('1000 個');
  });
});

test('offline dictionary data is deferred until editing and can retry a failed download', async ({ page, context }) => {
  await seed(page, 1);
  await page.evaluate(prefix => {
    const key = prefix + '2026-11-04', record = JSON.parse(localStorage.getItem(key)!);
    record.items[0].f.words[0].text = 'cell'; localStorage.setItem(key, JSON.stringify(record));
  }, prefix);
  let requests = 0;
  await page.route('**/ceecCoreMeanings-*.json', route => { if (++requests === 1) return route.abort(); return route.continue(); });
  await page.goto('/vocabulary.review.html');
  expect(requests).toBe(0);
  const row = page.locator('.vocabulary-row[data-entry-key="cell"]');
  await row.getByRole('button', { name: '編輯「cell」', exact: true }).click();
  await expect(row.locator('.dictionary-preview-status')).toContainText('暫時無法載入');
  await row.getByRole('button', { name: '取得翻譯', exact: true }).click();
  await expect(row.locator('[data-dictionary-meaning]').first()).toBeVisible();
  expect(requests).toBe(2);
  await context.setOffline(true);
  await row.getByRole('button', { name: '取得翻譯', exact: true }).click();
  await expect(row.locator('[data-dictionary-meaning]').first()).toBeVisible();
});
