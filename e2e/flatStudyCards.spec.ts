import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEEP_FIFTEEN_BOOK } from '../src/data/bookPageMaps.ts';
import type { StudyItem } from '../src/types.ts';

const prefix = 'study-v11:guest:';
const date = '2026-11-01';
const calendarTopic = 'Calendar 主題只保留在原始資料';

function studyItem(id: string, type: string, fields: StudyItem['f']): StudyItem {
  return { id, type, title: id, source: 'custom', required: false, done: false, minutes: '', f: fields };
}

async function seed(page: Page, items: StudyItem[], recordDate = date): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00+08:00'));
  // Seed from a read-only page so Tracker's departure save cannot replace the fixture.
  await page.goto('/summary.html');
  await page.evaluate(({ prefix, date, items }) => {
    localStorage.clear();
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(prefix + date, JSON.stringify({ schemaVersion: 2, date, items }));
  }, { prefix, date: recordDate, items });
  await page.goto('/');
  await page.locator('#studyDate').fill(recordDate);
  await page.locator('#studyDate').dispatchEvent('change');
}

async function expectRangeOnOneRow(card: Locator, startSelector: string, endSelector: string): Promise<void> {
  const start = card.locator(startSelector);
  const end = card.locator(endSelector);
  await expect(start).toBeVisible();
  await expect(start).toBeEditable();
  await expect(end).toBeVisible();
  await expect(end).toBeEditable();
  const first = await start.boundingBox();
  const last = await end.boundingBox();
  const bounds = await card.boundingBox();
  expect(first).not.toBeNull();
  expect(last).not.toBeNull();
  expect(bounds).not.toBeNull();
  expect(Math.abs(first!.y - last!.y)).toBeLessThan(2);
  expect(first!.x + first!.width).toBeLessThanOrEqual(last!.x);
  expect(first!.x).toBeGreaterThanOrEqual(bounds!.x);
  expect(last!.x + last!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
}

test('flat page and Unit cards keep ranges editable while references omit Calendar topics and stay current', async ({ page }, testInfo) => {
  const items = [
    studyItem('flat-math', 'mathStudy', { material: '教學講義', book: '1', start: '10', end: '12',
      calendarPlanTitle: calendarTopic, calendarUnitPages: 10, calendarWeekTarget: 5, calendarDailyPages: 2,
      calendarSuggestedBook: '1', calendarSuggestedStart: '10', calendarSuggestedEnd: '12' }),
    studyItem('flat-science', 'scienceReview', { subject: '生物', material: '新關鍵', start: '72', end: '82', calendarTopic }),
    studyItem('flat-english', 'extra', { title: 'Azar英文文法（中階）', start: '18', end: '21', calendarTopic }),
    studyItem('flat-chinese', 'chineseReading', { kind: 'book', book: DEEP_FIFTEEN_BOOK, start: '8', end: '25' }),
    studyItem('flat-unit', 'extra', { title: '自訂 Unit 教材', unitStart: '2', unitEnd: '3' }),
  ];
  await seed(page, items);
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const item of items) {
      const card = page.locator(`#itemList [data-item="${item.id}"]`);
      const reference = card.locator('.study-reference-details');
      await expect(reference).toHaveCount(1);
      await expect(reference).toHaveAttribute('open', '');
      await expect(reference.locator('.study-reference-content')).toBeVisible();
      await expect(reference.locator('input, select, textarea, button')).toHaveCount(0);
      await expect(reference).not.toContainText(calendarTopic);
      await expect(reference).not.toContainText('Google Calendar');
      await expect(reference).not.toContainText('建議進度');
      await expect(reference).not.toContainText('建議頁碼');
      await reference.locator('summary').click();
      await expect(reference.locator('.study-reference-content')).toBeHidden();
      const keys = item.id === 'flat-unit' ? ['unitStart', 'unitEnd'] : ['start', 'end'];
      await expectRangeOnOneRow(card, `[data-field="${keys[0]}"]`, `[data-field="${keys[1]}"]`);
      const surface = await card.evaluate(element => {
        const style = getComputedStyle(element);
        const field = getComputedStyle(element.querySelector('.field')!);
        return { background: style.backgroundColor, stripe: style.borderLeftWidth, shadow: style.boxShadow,
          fieldBorder: field.borderTopWidth, fieldBackground: field.backgroundColor };
      });
      const backgrounds: Record<string, string> = {
        'flat-math': 'rgb(251, 244, 229)', 'flat-science': 'rgb(238, 246, 242)',
        'flat-english': 'rgb(245, 241, 247)', 'flat-chinese': 'rgb(250, 241, 239)', 'flat-unit': 'rgb(245, 241, 247)',
      };
      expect(surface).toEqual({ background: backgrounds[item.id], stripe: '4px', shadow: 'none',
        fieldBorder: '0px', fieldBackground: 'rgba(0, 0, 0, 0)' });
      await reference.locator('summary').click();
      await expect(reference.locator('.study-reference-content')).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const card = page.locator('#itemList [data-item="flat-science"]');
  const oldReference = await card.locator('[data-science-auto]').textContent();
  await card.locator('[data-field="end"]').fill('97');
  await card.locator('[data-field="end"]').blur();
  await expect(card.locator('[data-science-auto]')).not.toHaveText(oldReference!);
  await card.locator('[data-minutes]').fill('22');
  await card.locator('[data-minutes]').blur();
  await card.locator('[data-check="progress"]').check();
  await card.locator(':scope > .item-top > [data-done]').check();
  await expect(card.locator('[data-completion-date]')).toBeVisible();
  await page.reload();
  await expect(card.locator('[data-field="end"]')).toHaveValue('97');
  await expect(card.locator('[data-minutes]')).toHaveValue('22');
  await expect(card.locator('[data-check="progress"]')).toBeChecked();
  await expect(card.locator(':scope > .item-top > [data-done]')).toBeChecked();
  await expect(card.locator('.study-reference-details')).toHaveAttribute('open', '');
  await expect(card.locator('[data-science-auto]')).toBeVisible();
  const storedTopic = await page.evaluate(({ prefix, date }) => {
    const record = JSON.parse(localStorage.getItem(prefix + date)!);
    return record.items.find((item: StudyItem) => item.id === 'flat-science').f.calendarTopic;
  }, { prefix, date });
  expect(storedTopic).toBe(calendarTopic);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await card.screenshot({ path: testInfo.outputPath(`flat-card-${width}.png`) });
  }
});

test('nested natural subjects use dividers and retain independent completion and time controls on mobile', async ({ page }, testInfo) => {
  const recordDate = '2026-10-24';
  const integration = studyItem('flat-integration', 'scienceReview', { subject: '混合', calendarNaturalIntegration: true, calendarTopic });
  integration.source = 'preset';
  integration.required = true;
  integration.presetKey = 'cal_natural_20261024';
  await seed(page, [integration], recordDate);
  await page.setViewportSize({ width: 320, height: 852 });
  const biology = page.locator(`[data-item="natural-integration-${recordDate}-生物"]`);
  const chemistry = page.locator(`[data-item="natural-integration-${recordDate}-化學"]`);
  const style = await biology.evaluate(element => {
    const style = getComputedStyle(element);
    return { border: style.borderLeftWidth, radius: style.borderRadius, shadow: style.boxShadow };
  });
  expect(style).toEqual({ border: '0px', radius: '0px', shadow: 'none' });
  await biology.locator(':scope > .item-top > [data-done]').check();
  await biology.locator('[data-minutes]').fill('12.5');
  await biology.locator('[data-minutes]').blur();
  await expect(chemistry.locator(':scope > .item-top > [data-done]')).not.toBeChecked();
  const details = biology.locator('.study-reference-details');
  await expect(details).toHaveAttribute('open', '');
  await expect(details).not.toContainText(calendarTopic);
  await expect(details.locator('.study-reference-content')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await biology.screenshot({ path: testInfo.outputPath('flat-natural-320.png') });
  await page.reload();
  await page.locator('#studyDate').fill(recordDate);
  await page.locator('#studyDate').dispatchEvent('change');
  await expect(biology.locator(':scope > .item-top > [data-done]')).toBeChecked();
  await expect(biology.locator('[data-minutes]')).toHaveValue('12.5');
  await expect(chemistry.locator(':scope > .item-top > [data-done]')).not.toBeChecked();
});

test('flat todo cards preserve direct range edits and synchronize them back to the original card', async ({ page }) => {
  const original = studyItem('flat-todo', 'scienceReview', { subject: '生物', material: '新關鍵', start: '72', end: '82' });
  original.source = 'preset';
  original.required = true;
  await seed(page, [original], '2026-10-29');
  await page.setViewportSize({ width: 320, height: 852 });
  await page.goto('/todo.html');
  const todo = page.locator('.todo-card').filter({ has: page.locator('[data-item-id="flat-todo"]') });
  await expect(todo).toBeVisible();
  await expect(todo).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(todo).toHaveCSS('border-left-width', '4px');
  await expect(page.locator('.study-record-section')).toHaveCSS('border-top-width', '0px');
  const end = todo.locator('[data-todo-range="end"]');
  await expect(end).toBeEditable();
  await end.fill('97');
  await end.blur();
  await page.reload();
  await expect(end).toHaveValue('97');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/');
  await page.locator('#studyDate').fill('2026-10-29');
  await page.locator('#studyDate').dispatchEvent('change');
  const card = page.locator('[data-item="flat-todo"]');
  await expect(card.locator('[data-field="end"]')).toHaveValue('97');
  await expect(card.locator('[data-field="start"]')).toBeVisible();
  await expect(card.locator('.study-reference-details')).toHaveAttribute('open', '');
});
