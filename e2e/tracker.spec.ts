import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '每日讀書完成度紀錄卡' })).toBeVisible();
});

test('whole-card deletion requires confirmation and small-row deletion can be undone', async ({ page }) => {
  await page.selectOption('#itemType', 'extra');
  await page.click('#addItemBtn');
  const customDelete = page.locator('#itemList [data-action="delete-item"]');
  await expect(customDelete).toHaveCount(1);

  page.once('dialog', dialog => dialog.dismiss());
  await customDelete.click();
  await expect(customDelete).toHaveCount(1);

  page.once('dialog', dialog => dialog.accept());
  await customDelete.click();
  await expect(customDelete).toHaveCount(0);

  await page.click('#addEnglishReviewBtn');
  await page.click('[data-action="word-add"]');
  const wordInput = page.locator('[data-word-text]');
  await wordInput.fill('regression');
  await page.click('[data-action="word-delete"]');
  await expect(page.locator('#deleteUndoToast')).toBeVisible();
  await page.click('#deleteUndoBtn');
  await expect(wordInput).toHaveValue('regression');
});

test('account recovery controls are readable without changing data', async ({ page }) => {
  await page.locator('#connectionSettings > summary').click();
  await expect(page.getByRole('button', { name: '忘記密碼' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重寄驗證信' })).toBeVisible();
  await page.getByRole('button', { name: '忘記密碼' }).click();
  await expect(page.locator('#cloudMessage')).toContainText('請先輸入');
});

test('expanded connection settings become a mobile bottom sheet', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#connectionSettings > summary').click();
  await expect(page.locator('#connectionSettings')).toHaveAttribute('open', '');
  expect(await page.locator('#connectionSettings').evaluate(node => getComputedStyle(node).position)).toBe('fixed');
  await expect(page.locator('body')).toHaveClass(/connection-sheet-open/);
  await context.close();
});

test('typed record fields write to storage only after leaving the field', async ({ page }) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__trackerStorageWrites = 0;
    Storage.prototype.setItem = function (key: string, value: string) {
      (window as any).__trackerStorageWrites += 1;
      return original.call(this, key, value);
    };
  });

  const notes = page.locator('#notes');
  await notes.fill('離開欄位後才儲存');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__trackerStorageWrites)).toBe(0);

  await notes.blur();
  await expect.poll(() => page.evaluate(() => (window as any).__trackerStorageWrites)).toBeGreaterThan(0);

  await page.click('#addEnglishReviewBtn');
  await page.click('[data-action="word-add"]');
  await page.evaluate(() => { (window as any).__trackerStorageWrites = 0; });
  const wordInput = page.locator('[data-word-text]').last();
  await wordInput.fill('save on blur');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__trackerStorageWrites)).toBe(0);

  await wordInput.blur();
  await expect.poll(() => page.evaluate(() => (window as any).__trackerStorageWrites)).toBeGreaterThan(0);
});
