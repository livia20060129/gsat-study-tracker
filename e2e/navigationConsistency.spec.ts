import { expect, test } from '@playwright/test';

test('all pages share desktop rails and accessible collapsible mobile rails without duplicate navigation', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 1024, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/todo.html', '/summary.html', '/material.progress.html', '/vocabulary.review.html', '/privacy.html', '/terms.html', '/support.html', '/gpt.prompt.html', '/vocabulary.sources.html']) {
      await page.goto(path);
      await expect(page.locator('body')).toHaveClass(/has-site-shell/);
      const home = page.locator('.site-workspace-home');
      const title = page.locator('h1:visible').first();
      await expect(title).toBeVisible();
      await expect(title).toHaveCSS('font-size', '28px');
      await expect(home).toHaveCSS('color', path === '/' ? 'rgb(57, 103, 233)' : 'rgb(23, 42, 57)');
      await expect(page.locator('.site-rail .site-connection')).toHaveCount(0);
      await expect(page.locator('.site-rail a[href="./summary.html"]')).toHaveCount(1);
      if (width >= 1200) {
        await expect(page.locator('.site-rail-left')).toBeVisible();
        await expect(page.locator('.site-rail-right')).toBeVisible();
        expect((await title.boundingBox())!.x).toBeGreaterThanOrEqual(200);
        await expect(page.locator('.site-mobile-bar')).toBeHidden();
      } else {
        await expect(page.locator('.site-rail-left')).toBeHidden();
        await expect(page.locator('.site-rail-right')).toBeHidden();
        await page.locator('[data-open-rail="right"]').click();
        await expect(home).toBeVisible();
        await expect(page.locator('.site-tools a')).toHaveCount(4);
        await page.keyboard.press('Escape');
        await expect(page.locator('.site-rail-right')).toBeHidden();
        await expect(page.locator('[data-open-rail="right"]')).toBeFocused();
        await page.locator('[data-open-rail="left"]').click();
        await expect(page.locator('.site-summary-link')).toBeVisible();
        await page.locator('.site-rail-left [data-close-rail]').click();
        await expect(page.locator('.site-rail-left')).toBeHidden();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path + ' fits viewport').toBe(true);
      if (path === '/' && [1440, 375].includes(width)) await page.screenshot({ path: testInfo.outputPath(`site-shell-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test('sidebar uses saved records and current-week overdue tasks without mixing account scopes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00+08:00'));
  await page.goto('/todo.html');
  await page.evaluate(() => {
    localStorage.clear(); localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:guest:');
    const record = { date: '2026-11-03', mood: '普通', items: [{ id: 'task', type: 'mathStudy', source: 'preset', required: true, done: false, minutes: '10', title: '數學 三角比', f: { material: '教學講義', book: '2', start: '10', end: '12' } }] };
    localStorage.setItem('study-v11:guest:2026-11-03', JSON.stringify(record));
    localStorage.setItem('study-v11:user:other:2026-11-04', JSON.stringify({ ...record, date: '2026-11-04' }));
  });
  await page.reload();
  await expect(page.locator('[data-rail-days]')).toHaveText('1');
  await expect(page.locator('[data-rail-overdue-count]')).toHaveText('1 項');
  await expect(page.locator('[data-rail-overdue-list]')).toContainText('三角比');
});

test('mood slider preserves date-specific values and updates the weekly rail after saving', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00+08:00'));
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/todo.html');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:guest:');
    for (const date of ['2026-11-04', '2026-11-05']) {
      localStorage.setItem(`study-v11:guest:${date}`, JSON.stringify({ date, items: [] }));
    }
  });
  await page.goto('/');
  await expect(page.locator('[data-rail-days]')).toHaveText('0');
  await expect(page.locator('#routineDisclosure')).not.toHaveAttribute('open');
  await page.getByRole('button', { name: '較疲累', exact: true }).click();
  await expect(page.locator('#mood')).toHaveValue('較疲累');
  await expect(page.locator('[data-rail-days]')).toHaveText('1');
  await page.locator('#studyDate').fill('2026-11-04');
  await page.locator('#studyDate').dispatchEvent('change');
  await expect(page.getByRole('button', { name: '未填寫', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '普通', exact: true }).click();
  await expect(page.locator('[data-rail-days]')).toHaveText('2');
  await page.locator('#studyDate').fill('2026-11-05');
  await page.locator('#studyDate').dispatchEvent('change');
  await expect(page.getByRole('button', { name: '較疲累', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: '較疲累', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-rail-days]')).toHaveText('2');
  await expect(page.locator('.connection-dock')).toBeVisible();
  await expect(page.locator('.site-rail-right .connection-dock')).toHaveCount(0);
});
