import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

async function buttonAppearance(button: Locator, includeWidth: boolean): Promise<Record<string, string>> {
  return button.evaluate((node, includeWidth) => {
    const style = getComputedStyle(node);
    const properties = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-synthesis', 'text-rendering',
      'line-height', 'letter-spacing', 'color', 'background-color', 'border-top-color', 'border-top-style',
      'border-top-width', 'border-radius', 'box-shadow', 'padding-top', 'padding-right', 'padding-bottom',
      'padding-left', 'text-align', 'justify-content', 'align-items', 'white-space', 'text-decoration-line',
      'height', 'outline-style', 'outline-width', 'outline-color', 'outline-offset'];
    if (includeWidth) properties.push('width');
    return Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)]));
  }, includeWidth);
}

test('every page shares bold navigation, full-width mobile button rows and desktop navigation at the right', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const paths = ['/', '/todo.html', '/summary.html', '/material.progress.html', '/vocabulary.review.html',
    '/privacy.html', '/terms.html', '/support.html', '/gpt.prompt.html', '/vocabulary.sources.html'];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1280, 701, 700, 375, 320]) {
    let homeHeading: Record<string, string> | undefined;
    const destinations = new Map<string, { text: string; appearance: Record<string, string> }>();
    const homeStates = new Map<string, Record<string, string>>();
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await page.mouse.move(0, 0);
      const backgrounds = await page.evaluate(() => [document.documentElement, document.body].map(node => {
        const style = getComputedStyle(node);
        return { color: style.backgroundColor, image: style.backgroundImage };
      }));
      expect(backgrounds, path + ' common page canvas').toEqual([
        { color: 'rgb(237, 242, 248)', image: 'none' }, { color: 'rgb(237, 242, 248)', image: 'none' },
      ]);
      const title = page.locator('h1:visible').first();
      const headingStyle = await title.evaluate(node => {
        const style = getComputedStyle(node);
        return Object.fromEntries(['font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
          'letter-spacing', 'text-align', 'color', 'margin-top', 'margin-bottom', 'padding-top', 'padding-left']
          .map(property => [property, style.getPropertyValue(property)]));
      });
      if (path === '/') homeHeading = headingStyle;
      else expect(headingStyle, path + ' heading matches the Tracker home page').toEqual(homeHeading);
      expect(headingStyle['font-size']).toBe('28px');
      expect(headingStyle['font-weight']).toBe('700');
      const titleBounds = (await title.boundingBox())!;
      expect(Math.abs(titleBounds.x - (Math.max(0, (width - 1120) / 2) + 14)), path + ' heading left alignment').toBeLessThan(1);
      if (width > 700) expect(Math.abs(titleBounds.y - 22), path + ' heading top alignment').toBeLessThan(1);
      const navigation = page.locator('.page-navigation-actions, .summary-view-controls').first();
      await expect(navigation).toBeVisible();
      const buttons = navigation.locator('.header-action-link');
      expect(await buttons.count(), path).toBeGreaterThan(0);
      for (const button of await buttons.all()) {
        const appearance = await buttonAppearance(button, width > 700);
        expect(Number(appearance['font-weight']), path).toBeGreaterThanOrEqual(700);
        expect(appearance['border-top-style'], path).toBe('solid');
        expect(appearance['text-decoration-line'], path).toBe('none');
        expect(appearance.height, path + ' common navigation height').toBe('44px');
        expect(await button.evaluate(node => node.scrollHeight <= node.clientHeight), path + ' button text stays inside').toBe(true);
        const destination = new URL((await button.getAttribute('href'))!, page.url()).pathname;
        const identity = { text: (await button.innerText()).trim(), appearance };
        const previous = destinations.get(destination);
        if (previous) expect(identity, path + ' same destination uses the same button format').toEqual(previous);
        else destinations.set(destination, identity);
      }
      if (width === 1280) {
        const home = navigation.locator('[data-navigation="home"]');
        if (await home.count()) {
          expect((await buttonAppearance(home, true)).width).toBe('136px');
          await home.hover();
          const hover = await buttonAppearance(home, true);
          if (homeStates.has('hover')) expect(hover, path + ' consistent home hover').toEqual(homeStates.get('hover'));
          else homeStates.set('hover', hover);
          await page.mouse.move(0, 0);
          // Set keyboard modality independently of the browser's Tab order.
          await page.keyboard.press('Tab');
          await home.focus();
          await expect(home).toBeFocused();
          const focus = await buttonAppearance(home, true);
          expect(focus['outline-style']).toBe('solid');
          expect(focus['outline-width']).toBe('3px');
          if (homeStates.has('focus')) expect(focus, path + ' consistent home keyboard focus').toEqual(homeStates.get('focus'));
          else homeStates.set('focus', focus);
          await home.evaluate(node => (node as HTMLElement).blur());
        }
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
      const navBounds = (await navigation.boundingBox())!;
      if (width <= 700) {
        const heading = (await page.locator('h1:visible').first().boundingBox())!;
        expect(Math.abs(navBounds.x + navBounds.width / 2 - width / 2), path).toBeLessThan(2);
        expect(navBounds.y + navBounds.height, path).toBeLessThanOrEqual(heading.y + 1);
        expect(Math.abs(heading.y - navBounds.y - navBounds.height - 16), path + ' heading gap below mobile navigation').toBeLessThan(1);
        const rows = await buttons.evaluateAll(nodes => {
          const rows: { top: number; left: number; right: number; widths: number[] }[] = [];
          for (const node of nodes) {
            const rect = node.getBoundingClientRect();
            let row = rows.find(row => Math.abs(row.top - rect.top) < 1);
            if (!row) {
              row = { top: rect.top, left: rect.left, right: rect.right, widths: [] };
              rows.push(row);
            }
            row.right = Math.max(row.right, rect.right);
            row.widths.push(rect.width);
          }
          return rows;
        });
        for (const row of rows) {
          expect(Math.abs(row.left - navBounds.x), path + ' row starts at the left edge').toBeLessThan(1);
          expect(Math.abs(row.right - navBounds.x - navBounds.width), path + ' row fills the available width').toBeLessThan(1);
          expect(Math.max(...row.widths) - Math.min(...row.widths), path + ' equal-width buttons').toBeLessThan(1);
        }
        const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth,
          elements: [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(-12).map(node => ({ tag: node.tagName, id: node.id, class: node.getAttribute('class'), right: node.getBoundingClientRect().right })),
        }));
        expect(overflow.width, path + JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
      } else {
        const contentRight = await navigation.evaluate(node => {
          const parent = node.parentElement!;
          const style = getComputedStyle(parent);
          return parent.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
        });
        expect(Math.abs(navBounds.x + navBounds.width - contentRight), path + ' desktop stays right aligned').toBeLessThan(1);
        if (await buttons.count() === 1) expect(navBounds.width, path + ' desktop keeps compact navigation').toBeLessThan(bounds.width / 2);
      }
      if ([1280, 375].includes(width) && ['/todo.html', '/summary.html', '/privacy.html', '/vocabulary.sources.html'].includes(path)) {
        await page.screenshot({ path: testInfo.outputPath(path.slice(1) + '-' + width + '.png'), animations: 'disabled' });
      }
    }
  }
  expect(errors).toEqual([]);
});
