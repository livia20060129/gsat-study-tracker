import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ timezoneId: 'Asia/Taipei' });
const prefix = 'study-v11:guest:';

async function seedItems(page: Page): Promise<void> {
  await page.clock.install({ time: new Date('2026-10-25T12:00:00+08:00') });
  await page.goto('/todo.html');
  await page.evaluate(prefix => {
    localStorage.clear();
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    for (const [date, id, type, title, f] of [
      ['2026-09-30', 'ace-old', 'extra', 'ACE Reading', { title: 'ACE Reading', round: '1' }],
      ['2026-10-19', 'ace-week', 'extra', 'ACE Reading', { title: 'ACE Reading', round: '2' }],
      ['2026-10-20', 'math', 'mathLecture', '數學講義：進度', { book: '第一冊', start: '10', end: '12' }],
      ['2026-10-23', 'physics', 'scienceReview', '物理', { subject: '物理', material: '新關鍵', start: '10', end: '12' }],
      ['2026-10-24', 'chemistry', 'scienceReview', '化學', { subject: '化學', material: '新關鍵', start: '10', end: '12' }],
      ['2026-10-25', 'today', 'scienceReview', '今天排程', { subject: '物理' }],
      ['2026-10-26', 'future', 'scienceReview', '未來排程', { subject: '物理' }],
    ]) {
      localStorage.setItem(prefix + date, JSON.stringify({ schemaVersion: 2, date, notes: '保留原筆記',
        items: [{ id, type, title, source: 'preset', required: true, done: false, minutes: '', f }] }));
    }
    const record = JSON.parse(localStorage.getItem(prefix + '2026-10-24')!);
    record.items.push({ id: 'interactive', type: 'interactiveDaily', title: '互動題', required: true, done: false, minutes: '', f: {} });
    localStorage.setItem(prefix + record.date, JSON.stringify(record));
  }, prefix);
  await page.reload();
}

async function snapshot(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(localStorage).sort().map(key => `${key}=${localStorage.getItem(key)}`));
}

test('item dropdown groups dates, combines with period and subject filters and restores the URL without writing records', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await seedItems(page);
  const before = await snapshot(page);
  const select = page.getByRole('combobox', { name: '查看項目', exact: true });
  await expect(select).toHaveValue('');
  await expect(select.locator('option')).toHaveCount(5);
  await select.selectOption({ label: '英文｜ACE Reading' });
  await expect(page.locator('.todo-card')).toHaveCount(2);
  await expect(page.locator('#todoSummary')).toHaveText('目前篩選 2 項｜全部 5 項待辦');
  await page.locator('#periodSwitch').getByRole('button', { name: '本週' }).click();
  await expect(page.locator('.todo-card')).toHaveCount(1);
  await page.getByRole('tab', { name: '英文', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('item')).toBe('english:ACE Reading');
  await page.reload();
  await expect(select).toHaveValue('english:ACE Reading');
  await expect(page.locator('.todo-card')).toHaveCount(1);
  const savedUrl = page.url();
  await page.getByRole('tab', { name: '自然', exact: true }).click();
  await expect(page.locator('.todo-card')).toHaveCount(0);
  await expect(page.locator('#todoEmpty')).toContainText('目前科目及期間內沒有待辦事項');
  await select.selectOption('');
  await expect(page.locator('.todo-card')).toHaveCount(2);
  await page.goto(savedUrl);
  await page.goto('/todo.html?item=unknown%3Aitem');
  await expect(select).toHaveValue('');
  await page.goBack();
  await expect(select).toHaveValue('english:ACE Reading');
  await expect(page.locator('.todo-card')).toHaveCount(1);
  await page.getByRole('tab', { name: '全部', exact: true }).click();
  await select.selectOption('natural:物理');
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await select.evaluate(node => {
      const bounds = node.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && node.scrollWidth <= node.clientWidth;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await select.focus();
  await select.press('Home');
  await select.press('Enter');
  await expect(select).toHaveValue('');
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: testInfo.outputPath('todo-item-dropdown-mobile.png') });
  expect(await snapshot(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test('item switching preserves running timers, completion dates and pending manual fields', async ({ page }) => {
  await seedItems(page);
  await page.clock.pauseAt(new Date('2026-10-25T12:01:00+08:00'));
  const select = page.getByRole('combobox', { name: '查看項目', exact: true });
  await select.selectOption('english:ACE Reading');
  const old = page.locator('.todo-card').filter({ has: page.locator('[data-item-id="ace-old"]') });
  await old.locator('[data-todo-completion-date]').fill('2026-10-22');
  await old.getByRole('button', { name: '計時', exact: true }).click();
  await old.getByRole('button', { name: '開始', exact: true }).click();
  await page.clock.runFor(65_000);
  const before = await snapshot(page);
  await select.selectOption('natural:物理');
  await expect(old).toHaveCount(0);
  await page.clock.runFor(35_000);
  await select.selectOption('english:ACE Reading');
  await expect(old.locator('[data-todo-timer-display]')).toHaveText('01:40');
  await expect(old.locator('[data-todo-completion-date]')).toHaveValue('2026-10-22');
  expect(await snapshot(page)).toEqual(before);
  await old.getByRole('button', { name: '完成計時', exact: true }).click();
  await old.getByRole('button', { name: '手動', exact: true }).click();
  await old.locator('[data-todo-minutes]').fill('23.5');
  await select.selectOption('natural:物理');
  await select.selectOption('english:ACE Reading');
  await expect(old.locator('[data-todo-minutes]')).toHaveValue('23.5');
  await expect(old.locator('[data-todo-completion-date]')).toHaveValue('2026-10-22');
  await expect(page.locator('#todoError')).toBeHidden();
});

test('completing and skipping the last selected items keeps the filter empty until undo or clearing it', async ({ page }) => {
  await seedItems(page);
  const select = page.getByRole('combobox', { name: '查看項目', exact: true });
  await select.selectOption('english:ACE Reading');
  await page.locator('.todo-card').first().getByRole('button', { name: '標記完成 ACE Reading', exact: true }).click();
  await expect(page.locator('.todo-card')).toHaveCount(1);
  await page.locator('.todo-card').getByRole('button', { name: '跳過 ACE Reading', exact: true }).click();
  await expect(page.locator('.todo-card')).toHaveCount(0);
  await expect(select).toHaveValue('english:ACE Reading');
  await expect(select.locator('option:checked')).toContainText('目前無待辦');
  await expect(page.locator('.todo-history-item')).toHaveCount(2);
  await expect(page.locator('#todoSummary')).toHaveText('目前篩選 0 項｜全部 3 項待辦');
  await page.reload();
  await expect(select).toHaveValue('english:ACE Reading');
  await expect(page.locator('.todo-card')).toHaveCount(0);
  await page.locator('.todo-history-item').first().getByRole('button', { name: '復原 ACE Reading', exact: true }).click();
  await expect(page.locator('.todo-card')).toHaveCount(1);
  await expect(select.locator('option:checked')).toHaveText('英文｜ACE Reading');
  await select.selectOption('');
  await expect(page.locator('.todo-card')).toHaveCount(4);
  await expect(page.locator('.todo-history-item')).toHaveCount(1);
  await expect(page.locator('#todoError')).toBeHidden();
});
