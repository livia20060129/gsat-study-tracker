import { expect, test, type Page } from '@playwright/test';
import { selectStudyDate } from './helpers/siteNavigation.ts';
import type { EnglishReviewWordEntry } from '../src/types.ts';

const userId = '00000000-0000-0000-0000-000000000001';
const prefix = `study-v11:user:${userId}:`;
const date = '2026-11-05';
async function seed(page: Page, signedIn = true): Promise<void> {
  await page.route('https://arxbirgujbrtzhoficdf.supabase.co/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/v1/user')) return route.fulfill({ json: { id: userId, aud: 'authenticated', email: 'test@example.com' } });
    if (path.includes('/functions/')) return route.fulfill({ json: { connected: false } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/vocabulary.review.html');
  await page.evaluate(({ signedIn, prefix, date, userId }) => {
    localStorage.clear();
    const scope = signedIn ? prefix : 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', scope);
    localStorage.setItem(scope + date, JSON.stringify({ date, items: [{ id: 'translation-words', type: 'englishVocabInteractive',
      source: 'custom', required: false, done: false, minutes: '', f: { words: [{ id: 'blank', text: '' }, { id: 'existing', text: 'ability' }] } }] }));
    if (signedIn) localStorage.setItem('sb-arxbirgujbrtzhoficdf-auth-token', JSON.stringify({
      access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature', refresh_token: 'test-refresh',
      expires_at: 1893456000, token_type: 'bearer', user: { id: userId, aud: 'authenticated', email: 'test@example.com' },
    }));
  }, { signedIn, prefix, date, userId });
  await page.route('**/dictionaries/ecdict-v1/*.json', route => route.fulfill({ json: {} }));
}
async function words(page: Page, scope = prefix): Promise<EnglishReviewWordEntry[]> {
  return page.evaluate(({ scope, date }) => JSON.parse(localStorage.getItem(scope + date)!).items.find((item: { id: string }) => item.id === 'translation-words').f.words, { scope, date });
}

test('Tracker uses Google only after a dictionary miss, preserves manual translation and displays its actual source in review', async ({ page }) => {
  await seed(page);
  const requests: string[] = [];
  await page.route('**/functions/v1/google-translation', route => {
    const word = route.request().postDataJSON().word; requests.push(word);
    return route.fulfill({ json: { provider: 'google', word, translation: '補充翻譯' } });
  });
  await page.goto('/'); await selectStudyDate(page, date);
  const input = page.locator('[data-item="translation-words"] [data-word-text][data-index="0"]');
  await input.fill('unlistedword'); await input.press('Tab');
  await expect.poll(async () => (await words(page))[0].translation).toBe('補充翻譯');
  expect((await words(page))[0]).toMatchObject({ vocabularyTranslationSource: 'Google Translate', translationsByPartOfSpeech: { unclassified: ['補充翻譯'] } });
  expect((await words(page))[0].gsatLevel).toBeUndefined();
  await page.goto('/vocabulary.review.html');
  const row = page.locator('.vocabulary-row[data-entry-key="unlistedword"]');
  await expect(row).toContainText('補充翻譯');
  await expect(page.locator('#googleTranslationSupport').getByRole('link', { name: 'Google Translate 自動翻譯來源' })).toBeVisible();
  await expect(row.getByRole('link', { name: 'Google Translate 自動翻譯來源' })).toHaveCount(0);
  await row.getByRole('button', { name: '編輯「unlistedword」', exact: true }).click();
  const translation = row.locator('[data-vocabulary-pos-translation]').first();
  await translation.fill('手動修正'); await translation.blur();
  await page.reload();
  await expect(row).toContainText('手動修正');
  expect(requests).toEqual(['unlistedword']);
});

test('guests retain the typed word without making a paid fallback request', async ({ page }) => {
  await seed(page, false);
  const requests: string[] = [];
  page.on('request', req => { if (req.url().endsWith('/google-translation')) requests.push(req.url()); });
  await page.goto('/'); await selectStudyDate(page, date);
  const input = page.locator('[data-item="translation-words"] [data-word-text][data-index="0"]');
  await input.fill('unlistedword'); await input.press('Tab');
  await page.reload();
  expect((await words(page, 'study-v11:guest:'))[0].text).toBe('unlistedword');
  expect(requests).toEqual([]);
});

test('a delayed fallback cannot overwrite newer spelling or write into another account', async ({ page }) => {
  await seed(page);
  let release = function (): void {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route('**/functions/v1/google-translation', async route => {
    requested = true; await gate;
    await route.fulfill({ json: { provider: 'google', word: 'unlistedword', translation: '過期翻譯' } });
  });
  await page.goto('/'); await selectStudyDate(page, date);
  const input = page.locator('[data-item="translation-words"] [data-word-text][data-index="0"]');
  await input.fill('unlistedword'); await input.press('Tab');
  await expect.poll(() => requested).toBe(true);
  await input.fill('ability'); await input.press('Tab');
  await expect.poll(async () => (await words(page))[0].translation).toContain('能力');
  await page.evaluate(() => localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:user:another:'));
  const response = page.waitForResponse('**/functions/v1/google-translation'); release(); await response;
  expect((await words(page))[0].text).toBe('ability');
  expect((await words(page))[0].translation).not.toBe('過期翻譯');
});

test('monthly word exhaustion explains the reset, saves Tracker input and leaves ECDICT available', async ({ page }) => {
  await seed(page);
  let requests = 0;
  await page.route('**/functions/v1/google-translation', route => {
    requests++;
    return route.fulfill({ status: 429, json: { code: 'translation_monthly_limit', quota: {
      allowed: false, unit: 'words', month: '2026-11', used: 5000, limit: 5000, remaining: 0, resetsAt: '2026-11-30T16:00:00Z',
    } } });
  });
  await page.goto('/'); await selectStudyDate(page, date);
  const card = page.locator('[data-item="translation-words"]');
  const input = card.locator('[data-word-text][data-index="0"]');
  await input.fill('unlistedword'); await input.press('Tab');
  const note = card.locator('[data-word-reference]').nth(0);
  await expect(note).toContainText('5,000 個單字');
  await expect(note).toContainText('12/1 台北時間 00:00 重置');
  expect((await words(page))[0].text).toBe('unlistedword');
  const core = card.locator('[data-word-text][data-index="1"]');
  await core.fill('apple'); await core.press('Tab');
  await expect.poll(async () => (await words(page))[1].translation).toBeTruthy();
  expect(requests).toBe(1);
  await page.reload(); await selectStudyDate(page, date);
  await expect(input).toHaveValue('unlistedword');
});

test('review quota errors retain the edited English and manual Chinese can still be saved', async ({ page }) => {
  await seed(page);
  await page.route('**/functions/v1/google-translation', route => route.fulfill({ status: 429, json: {
    code: 'translation_monthly_limit', quota: { allowed: false, unit: 'words', month: '2026-11', used: 5000,
      limit: 5000, remaining: 0, resetsAt: '2026-11-30T16:00:00Z' },
  } }));
  await page.reload();
  const old = page.locator('.vocabulary-row[data-entry-key="ability"]');
  await old.getByRole('button', { name: '編輯「ability」', exact: true }).click();
  const english = old.locator('[data-vocabulary-text]');
  await english.fill('unlistedword'); await english.blur();
  await expect(page.locator('#vocabularySaveStatus')).toContainText('5,000 個單字');
  const row = page.locator('.vocabulary-row[data-entry-key="unlistedword"]');
  await expect(row).toBeVisible();
  await row.getByLabel('Noun', { exact: true }).check();
  const translation = row.locator('[data-vocabulary-pos-translation]').first();
  await translation.fill('手動中文'); await translation.blur();
  await page.reload();
  await expect(row).toContainText('手動中文');
});

test('an unavailable quota counter gives a retry message without losing the typed word', async ({ page }) => {
  await seed(page);
  await page.route('**/functions/v1/google-translation', route => route.fulfill({ status: 503,
    json: { code: 'translation_quota_unavailable' } }));
  await page.goto('/'); await selectStudyDate(page, date);
  const input = page.locator('[data-item="translation-words"] [data-word-text][data-index="0"]');
  await input.fill('unlistedword'); await input.press('Tab');
  await expect(page.locator('[data-item="translation-words"] [data-word-reference]').first()).toContainText('暫時無法確認本月額度');
  expect((await words(page))[0].text).toBe('unlistedword');
});

test('a quota failure follows the saved word through background input replacement and later rerenders', async ({ page, context }) => {
  await seed(page);
  let release = function (): void {};
  let requested = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/functions/v1/google-translation', async route => {
    requested = true; await gate;
    await route.fulfill({ status: 503, json: { code: 'translation_quota_unavailable' } });
  });
  await page.goto('/'); await selectStudyDate(page, date);
  const input = page.locator('[data-item="translation-words"] [data-word-text][data-index="0"]');
  await input.fill('unlistedword'); await input.press('Tab');
  await expect.poll(() => requested).toBe(true);
  const original = await input.elementHandle();
  const other = await context.newPage();
  await other.goto('/vocabulary.review.html');
  async function changeNotes(value: string): Promise<void> {
    await other.evaluate(({ key, value }) => {
      const record = JSON.parse(localStorage.getItem(key)!);
      record.notes = value;
      localStorage.setItem(key, JSON.stringify(record));
    }, { key: prefix + date, value });
  }
  await changeNotes('background update before reply');
  await expect.poll(() => original!.evaluate(node => node.isConnected)).toBe(false);
  release();
  const note = page.locator('[data-item="translation-words"] [data-word-reference]').first();
  await expect(note).toContainText('暫時無法確認本月額度');
  const afterReply = await input.elementHandle();
  await changeNotes('background update after reply');
  await expect.poll(() => afterReply!.evaluate(node => node.isConnected)).toBe(false);
  await expect(note).toContainText('暫時無法確認本月額度');
  expect((await words(page))[0].text).toBe('unlistedword');
});

test('Google Chinese receives published ECDICT POS in Tracker and review, with manual overrides retained', async ({ page }) => {
  await seed(page);
  const calls: string[] = [];
  page.on('request', request => { if (request.url().includes('language.googleapis.com')) calls.push(request.url()); });
  await page.route('**/functions/v1/google-translation', route => route.fulfill({ json: {
    provider: 'google', word: 'afflation', translation: '靈感',
  } }));
  await page.goto('/'); await selectStudyDate(page, date);
  const card = page.locator('[data-item="translation-words"]');
  const input = card.locator('[data-word-text][data-index="0"]');
  await input.fill('afflation'); await input.press('Tab');
  await expect.poll(async () => (await words(page))[0].noun).toBe(true);
  expect((await words(page))[0].translationsByPartOfSpeech).toEqual({ noun: ['靈感'] });
  await expect(card.locator('[data-word-reference]').first()).toContainText('ECDICT｜詞性');
  await page.goto('/vocabulary.review.html');
  const row = page.locator('.vocabulary-row[data-entry-key="afflation"]');
  await expect(row).toContainText('Noun'); await expect(row).toContainText('靈感');
  await row.getByRole('button', { name: '編輯「afflation」', exact: true }).click();
  await row.getByLabel('Noun', { exact: true }).uncheck();
  await row.locator('[data-vocabulary-text]').fill('afflation');
  await row.locator('[data-vocabulary-text]').blur();
  await page.reload();
  expect((await words(page))[0].noun).toBe(false);
  expect(calls).toEqual([]);
});

for (const width of [1280, 375]) test(`dictionary choice changes links in place, persists and keeps editing and stars (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 812 });
  await seed(page); await page.reload();
  const row = page.locator('.vocabulary-row[data-entry-key="ability"]');
  await row.getByRole('button', { name: '編輯「ability」', exact: true }).click();
  const editor = await row.locator('[data-vocabulary-text]').elementHandle();
  const before = await words(page);
  await page.locator('#vocabularyDictionary').selectOption('cambridge');
  await expect(row.locator('.vocabulary-word-link')).toHaveAttribute('href', /dictionary\.cambridge\.org\/dictionary\/english-chinese-traditional\/ability$/);
  expect(await editor!.evaluate(node => node.isConnected)).toBe(true);
  expect(await words(page)).toEqual(before);
  await row.getByRole('button', { name: '標註整張卡片「ability」' }).click();
  await expect(row.getByRole('button', { name: '標註整張卡片「ability」' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#googleTranslationSupport')).toContainText('Google 翻譯支援');
  await expect(page.locator('.vocabulary-row a[aria-label="Google Translate 自動翻譯來源"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#vocabularyDictionary')).toHaveValue('cambridge');
  await expect(row.locator('.vocabulary-word-link')).toHaveAttribute('href', /cambridge/);
  await page.locator('#vocabularyDictionary').selectOption('oxford');
  await expect(row.locator('.vocabulary-word-link')).toHaveAttribute('href', /oxford.*q=ability/);
  expect(await page.locator('.vocabulary-reading-tools').evaluate(node => node.getBoundingClientRect().right <= innerWidth)).toBe(true);
});
