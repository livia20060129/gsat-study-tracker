import { expect, test } from '@playwright/test';

test('summary footer lists actual completions and follows the global period controls on mobile', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-17T12:00:00+08:00') });
  await page.goto('/summary.html');
  await page.evaluate(() => {
    localStorage.clear();
    const prefix = 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    const late = { id: 'late', type: 'englishPractice', title: '英文 <閱讀> & "練習"',
      done: true, minutes: '', required: true, source: 'preset', checkedOn: '2026-10-16',
      f: { book: 'ACE Reading', start: '18', end: '21' } };
    const records = [
      { date: '2026-09-30', items: [late] },
      { date: '2026-10-02', items: [{ ...late, id: 'month-only', title: '月初完成項目', checkedOn: '2026-10-02' }] },
      { date: '2026-10-17', mood: '身體不適', items: [
        { id: 'physics', type: 'scienceReview', title: '物理｜能量', done: true, minutes: '',
          required: true, source: 'preset', f: { subject: '物理', material: '新關鍵', start: '163', end: '180' } },
        { ...late, id: 'carry', deferredCarry: true, deferredOriginId: 'late', deferredOriginDate: '2026-09-30' },
        { ...late, id: 'pending', title: '尚未完成項目', done: false },
        { ...late, id: 'outside-week', title: '週外完成項目', checkedOn: '2026-10-21' },
      ] },
    ];
    for (const record of records) localStorage.setItem(`${prefix}${record.date}`, JSON.stringify(record));
  });
  await page.reload();
  const section = page.getByRole('region', { name: '本週完成項目' });
  await expect(section.locator('li')).toHaveCount(2);
  await expect(section).toContainText('英文 <閱讀> & "練習"');
  await expect(section).toContainText('ACE Reading｜p.18–21');
  await expect(section).toContainText('新關鍵｜p.163–180');
  await expect(section).toContainText('原排程 2026-09-30');
  await expect(section.locator('time')).toHaveText(['2026 年 10 月 17 日', '2026 年 10 月 16 日']);
  expect(await section.evaluate(node => node.parentElement?.querySelector(':scope > section:last-of-type') === node)).toBe(true);
  await page.locator('#includeStatusDaysCompletion').check();
  await expect(section.locator('li')).toHaveCount(2);
  await expect(page.getByRole('tablist', { name: '總結尺度' })).toHaveCount(1);

  await page.setViewportSize({ width: 320, height: 740 });
  await section.scrollIntoViewIfNeeded();
  const bounds = await section.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, scrollWidth: node.scrollWidth, width: node.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(320);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width + 1);
  await page.screenshot({ path: testInfo.outputPath('completed-items-mobile.png') });

  await page.getByRole('tab', { name: '月', exact: true }).click();
  const monthly = page.getByRole('region', { name: '本月完成項目' });
  await expect(monthly.locator('li')).toHaveCount(4);
  await expect(page.locator('#completedItemsCount')).toHaveText('共 4 項');
  await page.reload();
  await expect(monthly.locator('li')).toHaveCount(4);
  await page.getByRole('button', { name: '上一月', exact: true }).click();
  await expect(monthly).toContainText('本月尚無完成項目。');
  await expect(page.locator('#completedItemsCount')).toHaveText('共 0 項');
  await page.getByRole('button', { name: '下一月', exact: true }).click();
  await expect(monthly.locator('li')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('completed list refreshes after another tab saves, without modifying the saved record', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-10-17T12:00:00+08:00') });
  await page.goto('/summary.html');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:guest:');
  });
  await page.reload();
  await expect(page.locator('#summaryCompletedItems')).toContainText('本週尚無完成項目。');
  const writer = await context.newPage();
  await writer.goto('/summary.html');
  const stored = await writer.evaluate(() => {
    const json = JSON.stringify({ date: '2026-10-01', items: [
      { id: 'finished', type: 'mathLecture', title: '數學講義', done: true, checkedOn: '2026-10-17',
        minutes: '', required: true, source: 'preset', f: { material: '新大滿貫', start: '6', end: '19' } },
    ] });
    localStorage.setItem('study-v11:guest:2026-10-01', json);
    return json;
  });
  await expect(page.locator('#summaryCompletedItems li')).toHaveCount(1);
  await expect(page.locator('#summaryCompletedItems')).toContainText('數學講義');
  expect(await page.evaluate(() => localStorage.getItem('study-v11:guest:2026-10-01'))).toBe(stored);
  await writer.close();
});
