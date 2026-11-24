import { expect, test, type Page } from '@playwright/test';
import { showMobileSection } from './helpers/siteNavigation.ts';

interface OverlayState { visible: boolean; x: number; y: number; right: number; height: number }
declare global { interface Window { desktopOverlayProbe: { set(patch: Partial<OverlayState>): void } } }
async function overlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { visible: true, x: 0, y: 0, right: 160, height: 36 };
    const controller = new EventTarget();
    Object.defineProperties(controller, {
      visible: { get: () => state.visible },
      getTitlebarAreaRect: { value: () => ({ x: state.x, y: state.y, height: state.height, width: innerWidth - state.x - state.right }) },
    });
    Object.defineProperty(navigator, 'windowControlsOverlay', { configurable: true, value: controller });
    window.desktopOverlayProbe = { set(patch) { Object.assign(state, patch); controller.dispatchEvent(new Event('geometrychange')); } };
  });
}
test.use({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Taipei' });

for (const interruption of ['cancel', 'pause'] as const) test(`installed summary menu still navigates when its click animation is interrupted by ${interruption}`, async ({ page }) => {
  await overlay(page);
  await page.route('https://arxbirgujbrtzhoficdf.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto('/todo.html');
  await page.locator('#siteRightRail a[href="./summary.html"]').click();
  await expect(page).toHaveURL(/\/summary\.html$/);
  await expect(page.locator('html')).toHaveAttribute('data-desktop-titlebar', 'true');
  await page.evaluate(interruption => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(...args) {
      const animation = animate.apply(this, args);
      if (animation.id === 'study-menu-click-bounce') queueMicrotask(() => animation[interruption]());
      return animation;
    };
  }, interruption);
  await page.locator('#siteRightRail a[href="./material.progress.html"]').click();
  await expect(page).toHaveURL(/\/material\.progress\.html$/, { timeout: 2000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/summary\.html$/);
  await page.locator('#siteAppSettings').click();
  await expect(page.locator('#siteAppDialog')).toBeVisible();
  await page.locator('[data-app-close]').click();
  await page.locator('#siteRightRail a[href="./vocabulary.review.html"]').click();
  await expect(page).toHaveURL(/\/vocabulary\.review\.html$/, { timeout: 2000 });
});

test('Escape cancels a suspended installed-menu request without a delayed navigation, then another menu choice works', async ({ page }) => {
  await overlay(page); await page.goto('/summary.html');
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(...args) {
      const animation = animate.apply(this, args);
      if (animation.id === 'study-menu-click-bounce') animation.pause();
      return animation;
    };
  });
  await page.locator('#siteRightRail a[href="./material.progress.html"]').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(750);
  await expect(page).toHaveURL(/\/summary\.html$/);
  await page.locator('#siteRightRail a[href="./todo.html"]').click();
  await expect(page).toHaveURL(/\/todo\.html$/, { timeout: 2000 });
});

test('both rails reach the title area before hydration, with Study Tracker branding and no titlebar entry animation', async ({ page }, info) => {
  await overlay(page);
  let release = (): void => {};
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/site-shell.js*', async route => { await ready; await route.continue(); });
  try {
    await page.goto('/privacy.html', { waitUntil: 'commit' });
    await expect(page.locator('#siteDesktopTitlebar')).toBeVisible();
    await expect(page.locator('.site-desktop-brand')).toHaveText('Study Tracker');
    await expect(page.locator('#siteRecordDate')).toHaveCount(0);
    const anchors = page.locator('#siteDesktopTitlebar,#siteLeftRail,#siteRightRail,.site-tools');
    const before = await anchors.evaluateAll(nodes => nodes.map(node => {
      const {x,y,width,height} = node.getBoundingClientRect(); return {x,y,width,height};
    }));
    const seam = await page.locator('#siteDesktopTitlebar').evaluate(node => {
      const rect = node.getBoundingClientRect(), left = document.getElementById('siteLeftRail')!, right = document.getElementById('siteRightRail')!;
      return { top:rect.top, height:rect.height, leftTop:left.getBoundingClientRect().top, rightTop:right.getBoundingClientRect().top,
        leftColor:getComputedStyle(left).backgroundColor, rightColor:getComputedStyle(right).backgroundColor,
        before:getComputedStyle(node,'::before').backgroundColor, after:getComputedStyle(node,'::after').backgroundColor,
        leftWidth:getComputedStyle(node,'::before').width, rightWidth:getComputedStyle(node,'::after').width,
        leftRailWidth:left.getBoundingClientRect().width+'px', rightRailWidth:right.getBoundingClientRect().width+'px' };
    });
    expect(seam.top).toBe(0); expect(seam.height).toBe(36); expect(seam.leftTop).toBe(0); expect(seam.rightTop).toBe(0);
    expect(seam.before).toBe(seam.leftColor); expect(seam.after).toBe(seam.rightColor);
    expect(seam.leftWidth).toBe(seam.leftRailWidth); expect(seam.rightWidth).toBe(seam.rightRailWidth);
    release(); await expect(page.locator('#siteRecordDate')).toHaveCount(1);
    const after = await anchors.evaluateAll(nodes => nodes.map(node => {
      const {x,y,width,height} = node.getBoundingClientRect(); return {x,y,width,height};
    }));
    expect(after).toEqual(before);
    expect(await page.locator('#siteDesktopTitlebar').evaluate(node => node.getAnimations().length)).toBe(0);
    await page.screenshot({path:info.outputPath('desktop-integrated-titlebar.png')});
  } finally { release(); }
});

test('native caption buttons remain clear on either side and geometry changes restore the regular window layout', async ({ page }) => {
  await overlay(page); await page.goto('/todo.html');
  const titlebar = page.locator('#siteDesktopTitlebar');
  const content = page.locator('.site-desktop-titlebar-content');
  await expect(titlebar).toBeVisible();
  expect(await titlebar.locator('button,a,input,[role=button]').count()).toBe(0);
  for (const bounds of [{x:0,y:0,right:160,height:36}, {x:110,y:0,right:44,height:42}, {x:0,y:0,right:180,height:32}]) {
    await page.evaluate(bounds => window.desktopOverlayProbe.set(bounds), bounds);
    await expect.poll(() => titlebar.evaluate(node => node.getBoundingClientRect().height)).toBe(bounds.height);
    const area = await content.boundingBox(); expect(area).not.toBeNull();
    expect(area!.x).toBe(bounds.x); expect(area!.y).toBe(bounds.y);
    expect(area!.x + area!.width).toBeLessThanOrEqual(1440 - bounds.right);
    expect((await page.locator('.site-tools').boundingBox())!.y).toBeGreaterThanOrEqual(bounds.height);
  }
  await page.evaluate(() => window.desktopOverlayProbe.set({visible:false}));
  await expect(page.locator('html')).not.toHaveAttribute('data-desktop-titlebar');
  await expect(titlebar).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('padding-top','0px');
  await expect(page.locator('.site-brand')).toBeVisible();
  await page.evaluate(() => window.desktopOverlayProbe.set({visible:true}));
  await expect(titlebar).toBeVisible();
  await page.evaluate(() => window.desktopOverlayProbe.set({height:0}));
  await expect(titlebar).toBeHidden();
});

test('the titlebar stays fixed across shared pages and no user data changes when opening installed-app settings', async ({ page }) => {
  await overlay(page); await page.goto('/privacy.html');
  const key='study-v11:guest:2026-11-20', raw=JSON.stringify({date:'2026-11-20',items:[],notes:'保留原本的讀書筆記'});
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});
  for (const path of ['/privacy.html','/todo.html','/summary.html','/material.progress.html','/vocabulary.review.html','/gpt.prompt.html']) {
    await page.goto(path);
    await expect(page.locator('.site-desktop-brand')).toHaveText('Study Tracker');
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
    expect((await page.locator('#siteDesktopTitlebar').boundingBox())!.y).toBe(0);
    await page.locator('#siteAppSettings').click();
    await expect(page.locator('[data-app-instructions]')).toHaveText('目前已從 App 視窗開啟。');
    await expect(page.locator('[data-app-install]')).toBeHidden();
    await page.locator('[data-app-close]').click();
    expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
  }
});

test('a narrow installed window keeps its three sections below the native titlebar', async ({ page }) => {
  await overlay(page); await page.setViewportSize({width:880,height:800}); await page.goto('/todo.html');
  await expect(page.locator('#siteDesktopTitlebar')).toBeVisible();
  await expect(page.locator('.site-mobile-home')).toBeHidden();
  const bar=await page.locator('#siteMobileBar').boundingBox(); expect(bar!.y).toBeGreaterThanOrEqual(36);
  for (const section of ['date','tools','content'] as const) {
    await showMobileSection(page,section);
    await expect(page.locator('#siteDesktopTitlebar')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.locator('html').evaluate(node=>{(node as HTMLElement).dataset.menuPageEntry='pending';});
  await expect(page.locator('#siteDesktopTitlebar')).toBeVisible();
  await page.locator('html').evaluate(node=>{delete (node as HTMLElement).dataset.menuPageEntry;});
  await page.emulateMedia({media:'print'});
  await expect(page.locator('#siteDesktopTitlebar')).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('padding-top','0px');
  await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>window.desktopOverlayProbe.set({visible:false}));
  await expect(page.locator('.site-mobile-home')).toBeVisible();
  expect((await page.locator('#siteMobileBar').boundingBox())!.y).toBe(0);
});

test('unsupported browsers and ordinary mobile pages have no desktop titlebar gap', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#siteDesktopTitlebar')).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('padding-top','0px');
  await expect(page.locator('main > .app-header')).toHaveCount(0);
  await expect(page.locator('#connectionSettings')).toBeVisible();
  await page.setViewportSize({width:375,height:812}); await page.reload();
  await expect(page.locator('#siteDesktopTitlebar')).toBeHidden();
  await expect(page.locator('.site-mobile-home')).toBeVisible();
  expect((await page.locator('#siteMobileBar').boundingBox())!.y).toBe(0);
});
