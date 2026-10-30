import { expect, test } from '@playwright/test';

test('every page shares bold navigation, page width and centered navigation above mobile titles', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const paths = ['/', '/todo.html', '/summary.html', '/material.progress.html', '/vocabulary.review.html',
    '/privacy.html', '/terms.html', '/support.html', '/gpt.prompt.html', '/vocabulary.sources.html'];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      const navigation = page.locator('.page-navigation-actions, .summary-view-controls').first();
      await expect(navigation).toBeVisible();
      const buttons = navigation.locator('.header-action-link');
      expect(await buttons.count(), path).toBeGreaterThan(0);
      for (const button of await buttons.all()) {
        const style = await button.evaluate(node => {
          const style = getComputedStyle(node);
          return { weight: Number(style.fontWeight), border: style.borderTopStyle, decoration: style.textDecorationLine };
        });
        expect(style.weight, path).toBeGreaterThanOrEqual(700);
        expect(style.border, path).toBe('solid');
        expect(style.decoration, path).toBe('none');
      }
      const lightButtons = await page.locator('button:visible').evaluateAll(nodes => nodes
        .filter(node => Number(getComputedStyle(node).fontWeight) < 700)
        .map(node => ({ text: node.textContent, class: node.className })));
      expect(lightButtons, path + ' action buttons').toEqual([]);
      let containerSelector = 'body>main';
      if (path === '/vocabulary.sources.html') containerSelector = 'body';
      else if (/privacy|terms|support/.test(path)) containerSelector = '.header-inner';
      const pageContainer = page.locator(containerSelector);
      const bounds = (await pageContainer.boundingBox())!;
      expect(Math.abs(bounds.width - Math.min(width, 1120)), path).toBeLessThan(1);
      if (width <= 700) {
        const navBounds = (await navigation.boundingBox())!;
        const heading = (await page.locator('h1:visible').first().boundingBox())!;
        expect(Math.abs(navBounds.x + navBounds.width / 2 - width / 2), path).toBeLessThan(2);
        expect(navBounds.y + navBounds.height, path).toBeLessThanOrEqual(heading.y + 1);
        const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth,
          elements: [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(-12).map(node => ({ tag: node.tagName, id: node.id, class: node.getAttribute('class'), right: node.getBoundingClientRect().right })),
        }));
        expect(overflow.width, path + JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
      }
      if (width !== 320 && ['/summary.html', '/privacy.html', '/vocabulary.sources.html'].includes(path)) {
        await page.screenshot({ path: testInfo.outputPath(path.slice(1) + '-' + width + '.png') });
      }
    }
  }
  expect(errors).toEqual([]);
});
