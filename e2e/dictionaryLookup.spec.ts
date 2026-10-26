import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ timezoneId: 'Asia/Taipei' });
const date = '2026-10-26';
const userId = '00000000-0000-0000-0000-000000000001';
const payload = { ok: true, result: { provider: 'cambridge', word: 'cell',
  sourceUrl: 'https://dictionary.cambridge.org/dictionary/english-chinese-traditional/cell', meanings: [
    { partOfSpeech: 'noun', text: '候選意思甲' }, { partOfSpeech: 'noun', text: '未選意思乙' },
    { partOfSpeech: 'verb', text: '候選意思丙' },
  ] } };

async function seed(page: Page, authenticated = false): Promise<void> {
  await page.goto('/vocabulary.review.html');
  await page.evaluate(({ date, userId, authenticated }) => {
    localStorage.clear();
    const prefix = authenticated ? `study-v11:user:${userId}:` : 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    const words = [
      { id: 'cell', text: 'cell', noun: true, translation: '原有意思', gsatLevel: 4, showGsatLevel: false },
      { id: 'phrase', text: 'look after', fixedCombination: true, translation: '照顧' },
    ];
    localStorage.setItem(prefix + date, JSON.stringify({ schemaVersion: 2, date, notes: '不要清除筆記', items: [
      { id: 'review', type: 'englishVocabInteractive', source: 'custom', done: true, required: false,
        minutes: '25', checkedOn: date, f: { words } },
    ] }));
    if (authenticated) localStorage.setItem('sb-arxbirgujbrtzhoficdf-auth-token', JSON.stringify({
      access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature', refresh_token: 'test-refresh',
      token_type: 'bearer', expires_at: 1_893_456_000, expires_in: 3600, user: { id: userId, aud: 'authenticated', role: 'authenticated' },
    }));
  }, { date, userId, authenticated });
  await page.reload();
}

async function record(page: Page) {
  return page.evaluate(date => {
    const prefix = localStorage.getItem('study-v11:meta:active-record-prefix')!;
    return JSON.parse(localStorage.getItem(prefix + date)!);
  }, date);
}

async function editCell(page: Page) {
  const row = page.locator('.vocabulary-row[data-entry-key="cell"]');
  await row.getByRole('button', { name: '編輯「cell」', exact: true }).click();
  return row;
}

test('local preview is edit-only, sends no dictionary requests and saves only after selecting meanings and confirming', async ({ page }, testInfo) => {
  const external: string[] = [];
  page.on('request', request => {
    if (/dictionary\.cambridge\.org|functions\/v1\/dictionary-lookup/.test(request.url())) external.push(request.url());
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await seed(page);
  await expect(page.locator('[data-dictionary-lookup]')).toHaveCount(0);
  const row = await editCell(page);
  const before = await record(page);
  await row.getByRole('button', { name: '取得翻譯', exact: true }).click();
  await expect(row.locator('[data-dictionary-meaning]')).not.toHaveCount(0);
  await expect(row.locator('[data-dictionary-apply]')).toBeDisabled();
  expect(await record(page)).toEqual(before);
  await row.locator('[data-dictionary-meaning]').first().check();
  expect(await record(page)).toEqual(before);
  await row.locator('[data-dictionary-apply]').click();
  const saved = await record(page);
  expect(saved.items[0].f.words[0].translationsByPartOfSpeech.noun).toContain('原有意思');
  expect(saved.items[0].f.words[0].translationsByPartOfSpeech.noun.length).toBeGreaterThan(1);
  expect(saved.items[0].f.words[0].gsatLevel).toBe(4);
  expect(saved.items[0].f.words[0].showGsatLevel).toBe(false);
  expect(saved.items[0].minutes).toBe('25');
  expect(saved.notes).toBe('不要清除筆記');
  await row.getByRole('button', { name: '完成「cell」', exact: true }).click();
  await page.reload();
  await expect(row).toContainText('ECDICT（cell）');
  await page.getByRole('button', { name: '隱藏中文', exact: true }).click();
  await expect(row.locator('.vocabulary-meaning-answer').first()).toHaveCSS('visibility', 'hidden');
  await page.getByRole('button', { name: '組合', exact: true }).click();
  await page.locator('[data-entry-key="look after"]').getByRole('button', { name: '編輯「look after」', exact: true }).click();
  await expect(page.locator('[data-dictionary-lookup]')).toHaveCount(0);
  await page.getByRole('button', { name: '單字', exact: true }).click();
  await row.getByRole('button', { name: '編輯「cell」', exact: true }).click();
  await row.getByRole('button', { name: '取得翻譯', exact: true }).click();
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await row.screenshot({ path: testInfo.outputPath('dictionary-preview-mobile.png') });
  expect(external).toEqual([]);
});

test('guest Cambridge lookup fails clearly without sending a word and leaves manual editing available', async ({ page }) => {
  let requests = 0;
  await page.route('**/functions/v1/dictionary-lookup', async route => { requests++; await route.abort(); });
  await seed(page);
  const row = await editCell(page);
  await row.locator('[data-dictionary-provider]').selectOption('cambridge');
  await row.locator('[data-dictionary-lookup]').click();
  await expect(row.locator('.dictionary-preview-status')).toContainText('登入 Cloud');
  expect(requests).toBe(0);
  await row.locator('[data-vocabulary-pos-translation="noun"]').fill('仍可手動編輯');
  expect((await record(page)).items[0].f.words[0].translationsByPartOfSpeech.noun).toEqual(['仍可手動編輯']);
});

test('authenticated lookup previews only requested senses, requires confirmation and preserves optional Level and source attribution after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/functions/v1/dictionary-lookup', async route => {
    expect(route.request().postDataJSON()).toEqual({ word: 'cell' });
    expect(route.request().headers().authorization).toMatch(/^Bearer ey/);
    await route.fulfill({ json: payload });
  });
  await seed(page, true);
  const row = await editCell(page);
  const before = await record(page);
  await row.locator('[data-dictionary-provider]').selectOption('cambridge');
  await row.locator('[data-dictionary-lookup]').click();
  await expect(row.locator('[data-dictionary-meaning]')).toHaveCount(3);
  expect(await record(page)).toEqual(before);
  await row.locator('[data-dictionary-meaning="0"]').check();
  await row.locator('[data-dictionary-meaning="2"]').check();
  await row.locator('[data-dictionary-apply]').click();
  const word = (await record(page)).items[0].f.words[0];
  expect(word.translationsByPartOfSpeech).toEqual({ noun: ['原有意思', '候選意思甲'], verb: ['候選意思丙'] });
  expect(word.verb).toBe(true);
  expect(word.gsatLevel).toBe(4);
  expect(word.showGsatLevel).toBe(false);
  expect(JSON.stringify(word)).not.toContain('未選意思乙');
  await row.getByRole('button', { name: '完成「cell」', exact: true }).click();
  await page.reload();
  await expect(row.getByRole('link', { name: 'Cambridge Dictionary（cell）' })).toHaveAttribute('href', payload.result.sourceUrl);
  await expect(row).toContainText('候選意思甲');
  expect(errors).toEqual([]);
});

test('a late Cambridge response cannot fill a renamed word or replace its manually edited translation', async ({ page }) => {
  let release: (() => Promise<void>) | null = null;
  await page.route('**/functions/v1/dictionary-lookup', async route => {
    await new Promise<void>(resolve => { release = async () => { await route.fulfill({ json: payload }).catch(() => {}); resolve(); }; });
  });
  await seed(page, true);
  const row = await editCell(page);
  await row.locator('[data-dictionary-provider]').selectOption('cambridge');
  await row.locator('[data-dictionary-lookup]').click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await row.locator('[data-vocabulary-text]').fill('atom');
  await row.locator('[data-vocabulary-text]').blur();
  await expect(page.locator('.vocabulary-row[data-entry-key="atom"]')).toHaveCount(1);
  await release!();
  const saved = await record(page);
  expect(saved.items[0].f.words[0].text).toBe('atom');
  expect(saved.items[0].f.words[0].translation).toBe('原有意思');
  expect(JSON.stringify(saved)).not.toContain('候選意思甲');
});

test('missing API setup, invalid results and a timeout all preserve records and allow manual input', async ({ page }) => {
  await page.clock.install({ time: new Date(`${date}T12:00:00+08:00`) });
  let mode = 'missing';
  let release: (() => Promise<void>) | null = null;
  await page.route('**/functions/v1/dictionary-lookup', async route => {
    if (mode === 'missing') await route.fulfill({ status: 503, json: { ok: false, code: 'not_configured' } });
    else if (mode === 'invalid') await route.fulfill({ json: { ...payload, result: { ...payload.result, word: 'other' } } });
    else await new Promise<void>(resolve => { release = async () => { await route.abort().catch(() => {}); resolve(); }; });
  });
  await seed(page, true);
  const row = await editCell(page);
  const before = await record(page);
  await row.locator('[data-dictionary-provider]').selectOption('cambridge');
  await row.locator('[data-dictionary-lookup]').click();
  await expect(row.locator('.dictionary-preview-status')).toContainText('尚未設定');
  mode = 'invalid';
  await row.locator('[data-dictionary-lookup]').click();
  await expect(row.locator('.dictionary-preview-status')).toContainText('無法確認');
  mode = 'timeout';
  await row.locator('[data-dictionary-lookup]').click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.clock.runFor(12_100);
  await expect(row.locator('.dictionary-preview-status')).toContainText('查詢逾時');
  await release!();
  expect(await record(page)).toEqual(before);
  await row.locator('[data-vocabulary-pos-translation="noun"]').fill('手動輸入不受影響');
  expect((await record(page)).items[0].f.words[0].translationsByPartOfSpeech.noun).toEqual(['手動輸入不受影響']);
});

test('confirmation preserves newer unrelated record edits and reports a same-field conflict without overwriting either input', async ({ page }) => {
  await page.route('**/functions/v1/dictionary-lookup', route => route.fulfill({ json: payload }));
  await seed(page, true);
  const row = await editCell(page);
  await row.locator('[data-dictionary-lookup]').click();
  await row.locator('[data-dictionary-meaning]').first().check();
  await page.evaluate(date => {
    const key = localStorage.getItem('study-v11:meta:active-record-prefix')! + date;
    const value = JSON.parse(localStorage.getItem(key)!);
    value.notes = '最新筆記';
    value.items[0].minutes = '40';
    localStorage.setItem(key, JSON.stringify(value));
  }, date);
  await row.locator('[data-dictionary-apply]').click();
  expect((await record(page)).notes).toBe('最新筆記');
  expect((await record(page)).items[0].minutes).toBe('40');
  await row.locator('[data-dictionary-provider]').selectOption('cambridge');
  await row.locator('[data-dictionary-lookup]').click();
  await row.locator('[data-dictionary-meaning]').first().check();
  await page.evaluate(date => {
    const key = localStorage.getItem('study-v11:meta:active-record-prefix')! + date;
    const value = JSON.parse(localStorage.getItem(key)!);
    value.items[0].f.words[0].translation = '另一處改寫的翻譯';
    value.items[0].f.words[0].translationsByPartOfSpeech.noun = ['另一處改寫的翻譯'];
    localStorage.setItem(key, JSON.stringify(value));
  }, date);
  await row.locator('[data-dictionary-apply]').click();
  await expect(page.locator('#vocabularyError')).toContainText('同一欄位');
  expect((await record(page)).items[0].f.words[0].translation).toBe('另一處改寫的翻譯');
  await expect(row.locator('[data-dictionary-meaning]').first()).toBeChecked();
});
