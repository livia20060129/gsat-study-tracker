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

test('learning summary uses one week/month control for the complete page', async ({ page }) => {
  // Leave the record editor first: its pagehide handler deliberately persists
  // the current form and would otherwise overwrite this isolated fixture.
  await page.goto('/summary.html');
  await page.evaluate(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const prefix = 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(`${prefix}${date}`, JSON.stringify({
      schemaVersion: 1,
      date,
      wakeTime: '06:30',
      items: [
        { id: 'summary-math', type: 'mathStudy', done: true, minutes: '45', required: true, source: 'preset', f: { subject: '數學' } },
      ],
    }));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '學習總結' })).toBeVisible();
  await expect(page.locator('#summaryModeSwitch')).toHaveCount(1);
  await expect(page.locator('#summaryCalendar .summary-day')).toHaveCount(7);
  await expect(page.locator('#calendarTitle')).toHaveText('週曆');
  await expect(page.locator('#wakePeriodLabel')).toHaveText('本週平均');
  await expect(page.locator('#summarySubjectDistribution')).toContainText('45');

  await page.getByRole('tab', { name: '月' }).click();
  await expect(page.locator('#calendarTitle')).toHaveText('月曆');
  await expect(page.locator('#wakePeriodLabel')).toHaveText('本月平均');
  await expect(page.locator('.summary-calendar-weekdays')).toBeVisible();
  await expect(page.locator('#summaryCalendar .summary-day')).toHaveCount(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
  await expect(page.locator('#periodLabel')).toContainText('月');
});
