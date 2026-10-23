import { expect, test } from '@playwright/test';

test('TOEFL supplemental book uses live page lookup, persists, and charts only five large RANK/index segments', async ({ page }) => {
  const book = 'TOEFL托福決戰字彙3800';
  const date = '2026-10-22';
  const errors: string[] = [];
  page.on('pageerror', error => { errors.push(error.message); });
  await page.clock.install({ time: new Date('2026-10-23T12:00:00+08:00') });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#studyDate').fill(date);
  await page.locator('#studyDate').dispatchEvent('change');
  await page.locator('#itemType').selectOption('extra');
  await page.locator('#addItemBtn').click();
  const newCard = page.locator('#itemList > [data-item]').last();
  const id = await newCard.getAttribute('data-item');
  const card = page.locator(`#itemList > [data-item="${id}"]`);
  const title = card.locator('[data-field="title"]');
  await expect(title.locator(`optgroup[label="補充"] option[value="${book}"]`)).toHaveCount(1);
  await title.selectOption(book);
  await expect(card.locator('[data-field="unitStart"],[data-field="round"]')).toHaveCount(0);
  await card.locator('[data-field="start"]').fill('44');
  await card.locator('[data-field="end"]').fill('45');
  await card.locator('[data-field="end"]').blur();
  await expect(card.locator('[data-book-topic-auto]')).toHaveText('RANK 1、RANK 2');
  await expect(card.locator('[data-book-detail-auto]')).toHaveText('Vocabulary Building：聯想法、字彙');
  await card.locator('[data-field="start"]').fill('1');
  await card.locator('[data-field="end"]').fill('114');
  await card.locator('[data-field="end"]').blur();
  await card.locator('[data-minutes]').fill('30');
  await card.locator('[data-minutes]').blur();
  await card.locator('[data-done]').check();
  await page.reload();
  await page.locator('#studyDate').fill(date);
  await page.locator('#studyDate').dispatchEvent('change');
  await expect(title).toHaveValue(book);
  await expect(card.locator('[data-field="start"]')).toHaveValue('1');
  await expect(card.locator('[data-field="end"]')).toHaveValue('114');
  await expect(card.locator('[data-done]')).toBeChecked();
  await expect(card.locator('[data-minutes]')).toHaveValue('30');
  await page.getByRole('link', { name: '教材進度圖', exact: true }).click();
  await page.getByRole('tab', { name: '英文', exact: true }).click();
  const row = page.locator('.material-row').filter({ has: page.getByRole('heading', { name: book, exact: true }) });
  await expect(row.locator('.material-row-head strong')).toHaveText('完成 38%｜2／5 大單元已有紀錄');
  await expect(row.locator('.material-segment')).toHaveCount(5);
  await expect(row.locator('.material-segment.is-recorded')).toHaveCount(2);
  expect(await row.locator('.material-segment').evaluateAll(nodes => nodes.map(node => node.getAttribute('title')))).toEqual([
    'RANK 1（p.1–44）：完成 100%', 'RANK 2（p.45–114）：完成 100%',
    'RANK 3（p.115–196）：完成 0%', 'RANK 4（p.197–270）：完成 0%', '索引（p.271–298）：完成 0%',
  ]);
  await expect(row.locator('xpath=ancestor::section[contains(@class,"material-group")]').locator('.material-group-title')).toHaveText('補充');
  expect(errors).toEqual([]);
});
