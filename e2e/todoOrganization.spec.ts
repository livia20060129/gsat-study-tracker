import { expect, test, type Page } from '@playwright/test';

const prefix = 'study-v11:guest:';
async function seed(page: Page): Promise<void> {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00+08:00') });
  await page.goto('/todo.html');
  await page.evaluate(({ prefix }) => {
    localStorage.clear();
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    for (const date of ['2026-09-01', '2026-10-05', '2026-10-06', '2026-11-01', '2026-11-02', '2026-11-04']) {
      localStorage.setItem(prefix + date, JSON.stringify({ schemaVersion: 2, date, notes: '保留筆記', items: [
        { id: 'grammar', type: 'extra', title: '英文｜Essential Grammar in Use', source: 'preset', required: true, done: false, minutes: '15',
          f: { title: 'Essential Grammar in Use', scopeKind: 'unit', unitStart: '1', unitEnd: '2' } },
        { id: 'ace', type: 'extra', title: '英文｜ACE Reading', source: 'preset', required: true, done: false, minutes: '20', f: { title: 'ACE Reading', round: '5' } },
        { id: 'science', type: 'scienceReview', title: '物理讀書', source: 'preset', required: true, done: false, minutes: '25',
          f: { subject: '物理', material: '新關鍵', start: '10', end: '12', progress: true, graded: false, corrected: false } },
      ] }));
    }
  }, { prefix });
  await page.reload();
  await expect(page.locator('.todo-card')).toHaveCount(18);
}

test('30-day tasks stay visible, older tasks collapse by default and both groups support persistent date sorting', async ({ page }) => {
  await seed(page);
  await expect(page.locator('#todoRecentList .todo-card')).toHaveCount(12);
  await expect(page.locator('#todoLongTermList .todo-card')).toHaveCount(6);
  await expect(page.locator('#todoLongTerm')).not.toHaveAttribute('open', '');
  await expect(page.locator('#todoLongTermList .todo-card').first()).toBeHidden();
  await expect(page.locator('#todoRecentList .todo-card').first().locator('.todo-overdue')).toHaveText('逾期 30 天');
  await page.locator('#todoSort').selectOption('newest');
  await expect(page.locator('#todoRecentList .todo-card').first().locator('.todo-overdue')).toHaveText('逾期 1 天');
  await page.locator('#todoLongTerm > summary').click();
  await expect(page.locator('#todoLongTermList .todo-card').first().locator('.todo-overdue')).toHaveText('逾期 31 天');
  await page.reload();
  await expect(page.locator('#todoSort')).toHaveValue('newest');
  await expect(page.locator('#todoLongTerm')).not.toHaveAttribute('open', '');
});

test('batch skip honors subject, period and book filters, confirms the count and permits individual undo', async ({ page }) => {
  await seed(page);
  await expect(page.locator('#todoBatchSkip')).toBeDisabled();
  await page.getByRole('tab', { name: '英文', exact: true }).click();
  await page.locator('[data-period="week"]').click();
  await page.locator('#todoItemFilter').selectOption('english:Essential Grammar in Use');
  await expect(page.locator('.todo-card')).toHaveCount(2);
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('將跳過 2 項'); await dialog.dismiss(); });
  await page.locator('#todoBatchSkip').click();
  await expect(page.locator('.todo-card')).toHaveCount(2);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#todoBatchSkip').click();
  await expect(page.locator('.todo-card')).toHaveCount(0);
  await expect(page.locator('#todoFeedback')).toContainText('已跳過英文 2 項');
  const rows = await page.evaluate(({ prefix }) => ['2026-11-01', '2026-11-02', '2026-11-04'].map(date => JSON.parse(localStorage.getItem(prefix + date)!)), { prefix });
  expect(rows[0].items[0].f.overdueSkippedOn).toBeUndefined();
  for (const row of rows.slice(1)) {
    expect(row.items[0].f.overdueSkippedOn).toBe('2026-11-05');
    expect(row.items[1].f.overdueSkippedOn).toBeUndefined();
    expect(row.items[2].f.overdueSkippedOn).toBeUndefined();
    expect(row.notes).toBe('保留筆記');
    expect(row.items.every((item: { done: boolean }) => !item.done)).toBe(true);
    expect(row.items.map((item: { minutes: string }) => item.minutes)).toEqual(['15', '20', '25']);
  }
  await page.locator('.todo-history-undo').first().click();
  await expect(page.locator('.todo-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.todo-card')).toHaveCount(1);
});

test('batch failures report partial success and leave unprocessed dates intact', async ({ page }) => {
  await seed(page);
  await page.getByRole('tab', { name: '自然', exact: true }).click();
  await page.locator('[data-period="week"]').click();
  await page.evaluate(({ prefix }) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function failSecondDay(key, value): void {
      if (key === prefix + '2026-11-04') throw new DOMException('write blocked', 'QuotaExceededError');
      original.call(this, key, value);
    };
  }, { prefix });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#todoBatchSkip').click();
  await expect(page.locator('#todoError')).toContainText('已成功跳過 1 項，剩餘項目未處理');
  await expect(page.locator('.todo-card')).toHaveCount(1);
  await expect(page.locator('.todo-overdue')).toHaveText('逾期 1 天');
});

test('batch skip includes collapsed matching long-term tasks and leaves another subject timer running', async ({ page }) => {
  await seed(page);
  const science = page.locator('.todo-card').filter({ has: page.locator('[data-item-id="science"][data-record-date="2026-11-04"]') });
  await science.locator('[data-todo-time-mode="timer"]').click();
  await science.locator('[data-todo-timer-action="toggle"]').click();
  await page.getByRole('tab', { name: '英文', exact: true }).click();
  await page.locator('#todoItemFilter').selectOption('english:Essential Grammar in Use');
  await expect(page.locator('#todoLongTermList .todo-card')).toHaveCount(2);
  await expect(page.locator('#todoLongTermList .todo-card').first()).toBeHidden();
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('將跳過 6 項，其中長期逾期 2 項'); await dialog.accept(); });
  await page.locator('#todoBatchSkip').click();
  await expect(page.locator('.todo-card')).toHaveCount(0);
  await expect(page.locator('.todo-history-item')).toHaveCount(6);
  await page.getByRole('tab', { name: '自然', exact: true }).click();
  await expect(science.locator('[data-todo-timer-action="toggle"]')).toHaveText('暫停');
  const pointer = await page.evaluate(({ prefix }) => JSON.parse(localStorage.getItem(prefix + 'active-timer')!), { prefix });
  expect(pointer.itemId).toBe('science');
  expect(pointer.date).toBe('2026-11-04');
});

test('compact mode keeps only title overdue days and actions, expands editors and saves progress without losing drafts', async ({ page }, testInfo) => {
  await seed(page);
  await page.clock.pauseAt(new Date('2026-11-05T12:01:00+08:00'));
  await page.getByRole('tab', { name: '自然', exact: true }).click();
  await page.locator('[data-period="week"]').click();
  await page.locator('#todoView').selectOption('compact');
  const card = page.locator('#todoRecentList .todo-card').first();
  await expect(card.locator('h3')).toContainText('物理');
  await expect(card.locator('.todo-overdue')).toBeVisible();
  for (const selector of ['.todo-description', '.todo-record-grid', '.todo-progress-editor', '.todo-time-editor', '.todo-control-field', '.todo-subject']) {
    for (const node of await card.locator(selector).all()) await expect(node).toBeHidden();
  }
  await expect(card.locator('.todo-complete')).toBeVisible();
  await expect(card.locator('.todo-skip')).toBeVisible();
  await card.locator('.todo-expand').click();
  await expect(card.locator('[data-todo-range="end"]')).toBeEditable();
  await card.locator('[data-todo-range="end"]').fill('18');
  await card.locator('[data-todo-range="end"]').blur();
  await card.locator('[data-todo-progress="graded"]').check();
  await card.locator('[data-todo-time-mode="timer"]').click();
  await card.locator('[data-todo-timer-action="reset"]').click();
  await card.locator('[data-todo-timer-action="toggle"]').click();
  await page.clock.runFor(60_000);
  await card.locator('.todo-expand').click();
  await page.clock.runFor(60_000);
  await card.locator('.todo-expand').click();
  await expect(card.locator('[data-todo-timer-display]')).toHaveText('02:00');
  await card.locator('[data-todo-timer-action="finish"]').click();
  await card.locator('.todo-expand').click();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.runFor(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.screenshot({ path: testInfo.outputPath('compact-todo-mobile.png') });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.clock.runFor(250);
  await page.screenshot({ path: testInfo.outputPath('todo-organization-mobile.png'), fullPage: true });
  await card.locator('.todo-complete').click();
  await expect(page.locator('#todoRecentList .todo-card')).toHaveCount(1);
  const stored = await page.evaluate(({ prefix }) => JSON.parse(localStorage.getItem(prefix + '2026-11-02')!), { prefix });
  expect(stored.items[2].done).toBe(true);
  expect(stored.items[2].f.end).toBe('18');
  expect(stored.items[2].f.graded).toBe(true);
  expect(Number(stored.items[2].minutes)).toBe(2);
  await page.reload();
  await expect(page.locator('#todoView')).toHaveValue('compact');
  await expect(page.locator('#todoRecentList .todo-record-grid')).toBeHidden();
});
