import { expect, test, type Page } from '@playwright/test';

async function seed(page: Page): Promise<void> {
  await page.goto('/vocabulary.review.html');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:guest:');
    for (const date of ['2026-11-01', '2026-11-02']) localStorage.setItem(`study-v11:guest:${date}`, JSON.stringify({ schemaVersion: 2, date, items: [{
      id: 'review', type: 'englishVocabInteractive', done: true, minutes: '15', required: false, f: { words: [
        { id: 'alternate', text: 'alternate', noun: true, verb: true, gsatLevel: 3, showGsatLevel: true,
          translationsByPartOfSpeech: { noun: ['代替者', '候補者'], verb: ['輪流'] } },
        { id: 'phrase', text: 'pay a premium', fixedCombination: true, translation: '支付保費；支付溢價' },
        { id: 'sentence', text: 'Time after time, practice makes perfect.', beautifulSentences: true, translation: '一次又一次；熟能生巧' },
      ] },
    }] }));
  });
  await page.reload();
}

test('card, meaning and English stars are independent, survive sorting and reload, and clear all source copies', async ({ page }) => {
  await seed(page);
  const row = page.locator('.vocabulary-row[data-entry-key="alternate"]');
  const card = row.getByRole('button', { name: '標註整張卡片「alternate」', exact: true });
  const noun = row.getByRole('button', { name: '標註 Noun 第 2 筆翻譯', exact: true });
  await card.click();
  await noun.click();
  await expect(row.getByRole('button', { name: '標註 Noun 第 1 筆翻譯', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await row.getByRole('button', { name: '個別標註', exact: true }).click();
  await row.getByRole('button', { name: '標註英文單字「alternate」', exact: true }).click();
  await row.getByRole('button', { name: '結束標註', exact: true }).click();
  await expect(row.locator('.vocabulary-word-link .is-word-starred')).toHaveText('alternate');
  await page.getByRole('button', { name: '隱藏中文', exact: true }).click();
  await expect(row.locator('.vocabulary-meaning-answer').first()).toHaveCSS('visibility', 'hidden');
  await expect(noun).toHaveAttribute('aria-pressed', 'true');
  await noun.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '詞性', exact: true }).click();
  const copies = page.locator('.vocabulary-row[data-entry-key="alternate"]');
  await expect(copies).toHaveCount(2);
  await copies.first().getByRole('button', { name: '標註 Verb 第 1 筆翻譯', exact: true }).click();
  for (const copy of await copies.all()) await expect(copy.getByRole('button', { name: '標註 Verb 第 1 筆翻譯', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(noun).toHaveAttribute('aria-pressed', 'false');
  await expect(row.locator('.is-word-starred')).toHaveCount(1);
  await card.click();
  const saved = await page.evaluate(() => ['2026-11-01', '2026-11-02'].map(date => JSON.parse(localStorage.getItem(`study-v11:guest:${date}`)!).items[0]));
  for (const item of saved) {
    expect(item.done).toBe(true);
    expect(item.minutes).toBe('15');
    expect(item.f.words[0].vocabularyStars).toEqual(expect.objectContaining({ card: false, 'word:alternate:0': true }));
    expect(item.f.words[1].vocabularyStars).toBeUndefined();
  }
});

test('mobile phrases and sentences support separate repeated English tokens and each masked translation without overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(page);
  await page.getByRole('button', { name: '組合', exact: true }).click();
  const phrase = page.locator('.vocabulary-row[data-entry-key="pay a premium"]');
  await phrase.getByRole('button', { name: '個別標註', exact: true }).click();
  await phrase.getByRole('button', { name: '標註英文單字「premium」', exact: true }).click();
  await phrase.getByRole('button', { name: '標註 中文 第 2 筆翻譯', exact: true }).click();
  await page.getByRole('button', { name: '句子', exact: true }).click();
  const sentence = page.locator('.vocabulary-row').filter({ hasText: 'Time after time' });
  await sentence.getByRole('button', { name: '個別標註', exact: true }).click();
  const repeated = sentence.locator('[data-star-key^="word:time:"]');
  await expect(repeated).toHaveCount(2);
  await repeated.nth(1).click();
  await expect(repeated.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(repeated.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await sentence.getByRole('button', { name: '標註 中文 第 1 筆翻譯', exact: true }).click();
  await page.getByRole('button', { name: '隱藏中文', exact: true }).click();
  await expect(sentence.locator('.vocabulary-meaning-mask')).toHaveText(['－', '－']);
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await sentence.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await sentence.screenshot({ path: testInfo.outputPath(`vocabulary-stars-${width}.png`) });
  }
  await page.reload();
  await page.getByRole('button', { name: '句子', exact: true }).click();
  await expect(sentence.locator('.is-word-starred')).toHaveText('time');
  await expect(sentence.getByRole('button', { name: '標註 中文 第 1 筆翻譯', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('star clicks preserve editing inputs and meaning corrections keep the right star after deleting a neighbor', async ({ page }) => {
  await seed(page);
  const row = page.locator('.vocabulary-row[data-entry-key="alternate"]');
  await row.getByRole('button', { name: '標註 Noun 第 2 筆翻譯', exact: true }).click();
  await row.getByRole('button', { name: '編輯「alternate」', exact: true }).click();
  const input = row.getByLabel('Noun 中文翻譯 2', { exact: true });
  await input.fill('替補者');
  await row.getByRole('button', { name: '標註整張卡片「alternate」', exact: true }).click();
  await expect(input).toHaveValue('替補者');
  await row.getByRole('button', { name: '刪除 Noun 第 1 個翻譯', exact: true }).click();
  await row.getByRole('button', { name: '完成「alternate」', exact: true }).click();
  await expect(row.locator('.vocabulary-meaning-answer').first()).toHaveText('替補者');
  await expect(row.getByRole('button', { name: '標註 Noun 第 1 筆翻譯', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(row.getByRole('button', { name: '標註整張卡片「alternate」', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(row.getByRole('button', { name: '標註 Noun 第 1 筆翻譯', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('a deleted unrelated record cannot block any of the three star controls', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => localStorage.setItem('study-v11:guest:2026-10-30', JSON.stringify({ date: '2026-10-30', items: [] })));
  await page.reload();
  await page.evaluate(() => localStorage.removeItem('study-v11:guest:2026-10-30'));
  const row = page.locator('.vocabulary-row[data-entry-key="alternate"]');
  const card = row.locator('[data-star-key="card"]');
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await row.getByRole('button', { name: '個別標註', exact: true }).click();
  const word = row.getByRole('button', { name: '標註英文單字「alternate」', exact: true });
  await word.click();
  await expect(word).toHaveAttribute('aria-pressed', 'true');
  const meaning = row.getByRole('button', { name: '標註 Noun 第 2 筆翻譯', exact: true });
  await meaning.click();
  await expect(meaning).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(meaning).toHaveAttribute('aria-pressed', 'true');
  await expect(row.locator('.is-word-starred')).toHaveText('alternate');
  expect(await page.evaluate(() => localStorage.getItem('study-v11:guest:2026-10-30'))).toBeNull();
});

test('touching the icon center or button edge toggles every star type', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 375, height: 812 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await seed(page);
    for (const kind of ['單字', '組合', '句子']) {
      await page.getByRole('button', { name: kind, exact: true }).click();
      const row = page.locator('.vocabulary-row').first();
      await row.getByRole('button', { name: '個別標註', exact: true }).click();
      for (const button of await row.locator('[data-star-key]').all()) {
        await button.scrollIntoViewIfNeeded();
        const bounds = (await button.boundingBox())!;
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await page.touchscreen.tap(bounds.x + 3, bounds.y + 3);
        await expect(button).toHaveAttribute('aria-pressed', 'false');
      }
    }
  } finally { await context.close(); }
});
