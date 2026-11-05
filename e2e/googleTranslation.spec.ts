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
  await expect(row.getByRole('link', { name: 'Google Translate 自動翻譯來源' })).toBeVisible();
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
