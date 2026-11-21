import { expect, test, type Page } from '@playwright/test';

const PREFIX = 'study-v11:guest:';
const instantClick = (page: Page, selector: string) => page.locator(selector).evaluate(node => {
  if (node instanceof HTMLElement) node.click();
  else node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});

async function seed(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
  await page.clock.install({ time: new Date('2026-11-05T12:00:00+08:00') });
  await page.goto('/summary.html');
  await page.evaluate(prefix => {
    localStorage.clear();
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    const item = (id: string, subject: string, minutes: string, done = true) => ({
      id, type: 'general', title: subject + '｜讀書項目', required: true, source: 'preset', done, minutes, f: { subject },
    });
    const records = [
      { date: '2026-10-30', items: [item('oct', '英文', '30')] },
      { date: '2026-11-02', items: [item('one', '數學', '60'), item('pending', '英文', '', false)] },
      { date: '2026-11-03', items: [item('two', '英文', '30')] },
      { date: '2026-11-09', items: [item('three', '英文', '180')] },
      { date: '2026-11-10', items: [item('four', '數學', '60')] },
      { date: '2026-12-01', items: [item('dec', '數學', '300')] },
    ];
    records.forEach(record => localStorage.setItem(prefix + record.date, JSON.stringify(record)));
  }, PREFIX);
  await page.reload();
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('1.5');
  // Pause the browser clock after bootstrap; advance actual RAF callbacks explicitly.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
}

async function read(page: Page) {
  return page.evaluate(() => ({
    hours: document.querySelector('#summarySubjectDistribution .summary-donut-center strong')!.textContent!,
    completion: Number(document.querySelector('#summaryTotalCompletion')!.textContent!.replace('%', '')),
    angle: parseFloat((document.querySelector('.summary-day') as HTMLElement).style.getPropertyValue('--day-completion')),
    line: document.querySelector('#summaryTrend polyline')!.getAttribute('points'),
    arc: document.querySelector('[data-summary-subject-path="數學"]')?.getAttribute('d'),
    running: document.getElementById('summaryContent')!.hasAttribute('data-summary-period-motion'),
    opacity: getComputedStyle(document.getElementById('summaryContent')!).opacity,
    transform: getComputedStyle(document.getElementById('summaryContent')!).transform,
  }));
}

async function saved(page: Page) {
  return page.evaluate(prefix => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith(prefix) && /\d{4}-\d{2}-\d{2}$/.test(key)).sort().map(key => [key, localStorage.getItem(key)])), PREFIX);
}

test('changing weeks morphs intermediate data in place and keeps exact final values and source records', async ({ page }) => {
  await seed(page);
  const storage = await saved(page), before = await read(page);
  await page.locator('.summary-card').evaluateAll(nodes => nodes.forEach((node, i) => { node.setAttribute('data-original-card', String(i)); }));
  const bounds = await page.locator('.summary-calendar-card,.summary-subject-card,.summary-trend-card').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
  await instantClick(page, '#nextPeriod');
  await expect(page.locator('#periodLabel')).toContainText('11/09');
  const start = await read(page);
  expect(start.hours).toBe(before.hours);
  expect(start.running).toBe(true);
  await page.clock.runFor(180);
  const middle = await read(page);
  expect(Number(middle.hours)).toBeGreaterThan(1.5);
  expect(Number(middle.hours)).toBeLessThan(4);
  expect(middle.completion).toBeGreaterThan(before.completion);
  expect(middle.completion).toBeLessThan(100);
  expect(middle.angle).toBeGreaterThan(before.angle);
  expect(middle.angle).toBeLessThan(360);
  expect(middle.line).not.toBe(before.line);
  expect(middle.arc).not.toBe(before.arc);
  expect(middle.opacity).toBe('1');
  expect(middle.transform).toBe('none');
  expect(await page.locator('.summary-calendar-card,.summary-subject-card,.summary-trend-card').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }))).toEqual(bounds);
  await page.clock.runFor(600);
  expect(await read(page)).toMatchObject({ hours: '4.0', completion: 100, angle: 360, running: false });
  await expect(page.locator('[data-original-card]')).toHaveCount(await page.locator('.summary-card').count());
  await expect(page.locator('[data-summary-morph-exit]')).toHaveCount(0);
  expect(await saved(page)).toEqual(storage);
});

test('rapid reversal starts at the painted value and only the latest period survives', async ({ page }) => {
  await seed(page);
  await instantClick(page, '#nextPeriod');
  await page.clock.runFor(160);
  const painted = await read(page);
  await instantClick(page, '#previousPeriod');
  const reversed = await read(page);
  expect(reversed.hours).toBe(painted.hours);
  expect(reversed.arc).toBe(painted.arc);
  expect(reversed.line).toBe(painted.line);
  await page.evaluate(() => { document.getElementById('nextPeriod')!.click(); document.getElementById('nextPeriod')!.click(); document.getElementById('previousPeriod')!.click(); });
  await page.clock.runFor(800);
  await expect(page.locator('#periodLabel')).toContainText('11/09');
  expect(await read(page)).toMatchObject({ hours: '4.0', completion: 100, running: false });
  await expect(page.locator('[data-summary-morph-exit]')).toHaveCount(0);
  await page.clock.runFor(1200);
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('4.0');
  await instantClick(page, '#nextPeriod');
  await page.clock.runFor(700);
  await page.evaluate(() => { document.getElementById('previousPeriod')!.click(); document.getElementById('nextPeriod')!.click(); document.getElementById('previousPeriod')!.click(); });
  expect(await page.locator('#summarySubjectDistribution svg').innerHTML()).not.toMatch(/NaN|Infinity/);
  await page.clock.runFor(700);
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('4.0');
  await expect(page.locator('[data-summary-morph-exit]')).toHaveCount(0);
});

test('month lengths and interleaved mode/date changes keep complete finite charts on mobile', async ({ page }) => {
  await seed(page, 375);
  const storage = await saved(page);
  await instantClick(page, '[data-summary-mode="month"]');
  await page.clock.runFor(600);
  await expect(page.locator('#summaryCalendar .summary-day')).toHaveCount(30);
  await instantClick(page, '#nextPeriod');
  await page.clock.runFor(180);
  await expect(page.locator('#summaryCalendar .summary-day')).toHaveCount(31);
  const polyline = await page.locator('#summaryTrend polyline').getAttribute('points');
  expect(polyline).not.toMatch(/NaN|Infinity/);
  expect(polyline!.split(' ')).toHaveLength(31);
  await page.evaluate(() => { document.querySelector<HTMLElement>('[data-summary-mode="week"]')!.click(); document.getElementById('previousPeriod')!.click(); document.querySelector<HTMLElement>('[data-summary-mode="month"]')!.click(); });
  await page.clock.runFor(1000);
  await expect(page.locator('#periodLabel')).toHaveText('2026 年 11 月');
  await expect(page.locator('#summaryCalendar .summary-day')).toHaveCount(30);
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('5.5');
  await expect(page.locator('[data-summary-morph-exit]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await saved(page)).toEqual(storage);
});

test('subject filtering, empty periods and missing sleep records stay usable during motion', async ({ page }) => {
  await seed(page);
  await instantClick(page, '[data-summary-subject="英文"]');
  await instantClick(page, '#nextPeriod');
  await page.clock.runFor(700);
  expect(await page.locator('#summarySubjectDistribution').evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  await expect(page.locator('#subjectTitle')).toHaveText('科目分配｜英文');
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('3.0');
  await expect(page.locator('#summaryCompletedItems li')).toHaveCount(1);
  await instantClick(page, '#nextPeriod');
  await page.clock.runFor(700);
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('0.0');
  await expect(page.locator('#summarySubjectDistribution')).toContainText('本期尚無此科目的完成時間紀錄');
  await expect(page.locator('#averageSleepDuration')).toHaveText('—');
  await expect(page.locator('#sleepTrend circle')).toHaveCount(0);
  await expect(page.locator('[data-summary-morph-exit]')).toHaveCount(0);
  await instantClick(page, '#previousPeriod');
  await page.clock.runFor(700);
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('3.0');
  await instantClick(page, '[data-summary-back]');
  await page.clock.runFor(600);
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('4.0');
  await expect(page.locator('.summary-donut-return-overlay')).toHaveCount(0);
});

test('a saved-data refresh or scope change stops an older animation from repainting stale data', async ({ page }) => {
  await seed(page);
  await instantClick(page, '#nextPeriod');
  await page.clock.runFor(100);
  await page.evaluate(prefix => {
    const key=prefix+'2026-11-09', record=JSON.parse(localStorage.getItem(key)!); record.items[0].minutes='360';
    const value=JSON.stringify(record);localStorage.setItem(key,value);window.dispatchEvent(new StorageEvent('storage',{key,newValue:value,storageArea:localStorage}));
  }, PREFIX);
  await page.clock.runFor(1200);
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('7.0');
  await instantClick(page, '#previousPeriod');
  await page.clock.runFor(100);
  await page.evaluate(() => {
    const key='study-v11:meta:active-record-prefix';localStorage.setItem(key,'study-v11:user:another:');
    window.dispatchEvent(new StorageEvent('storage',{key,newValue:'study-v11:user:another:',storageArea:localStorage}));
  });
  await page.clock.runFor(1200);
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('0.0');
  await expect(page.locator('#summaryContent')).not.toHaveAttribute('data-summary-period-motion');
  await expect(page.locator('[data-summary-morph-exit]')).toHaveCount(0);
});

test('reduced motion settles a running transition immediately and subsequent period changes skip animation', async ({ page }) => {
  await seed(page);
  await instantClick(page, '#nextPeriod');
  await page.clock.runFor(100);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.runFor(30);
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('4.0');
  await expect(page.locator('#summaryContent')).not.toHaveAttribute('data-summary-period-motion');
  await instantClick(page, '#previousPeriod');
  expect(await read(page)).toMatchObject({ hours: '1.5', running: false });
  await instantClick(page, '[data-summary-mode="month"]');
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('5.5');
  await expect(page.locator('[data-summary-morph-exit]')).toHaveCount(0);
});
