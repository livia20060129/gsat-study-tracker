import { expect, test } from '@playwright/test';
import { showMobileSection } from './helpers/siteNavigation.ts';

test('security headers reject injected inline script while prompt copy still works', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(text:string) { document.documentElement.dataset.promptCopied=text; }}});
  });
  const response=await page.goto('/gpt.prompt.html');
  expect(response!.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response!.headers()['x-frame-options']).toBe('DENY');
  await page.getByRole('button',{name:'複製完整 Prompt',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-prompt-copied',/角色與目標/);
  await page.evaluate(() => { const script=document.createElement('script'); script.textContent='document.documentElement.dataset.inlineRan="true"'; document.body.append(script); });
  await expect(page.locator('html')).not.toHaveAttribute('data-inline-ran');
});

test('Lucide navigation keeps labels and all three Menu strokes at mobile size', async ({ page },testInfo) => {
  await page.setViewportSize({width:393,height:852}); await page.goto('/');
  const menu=page.locator('#siteMobileBar [data-mobile-section="tools"]');
  await expect(menu.locator('[data-ui-icon="menu"] svg')).toBeVisible();
  await expect(menu.locator('svg path')).toHaveCount(3);
  await expect(page.locator('#siteMobileBar [data-mobile-section="date"] [data-ui-icon="calendar-days"]')).toBeVisible();
  await expect(page.locator('#saveBtn')).toHaveAccessibleName('儲存紀錄');
  await expect(page.locator('#saveBtn')).toContainText('儲存紀錄');
  await expect(page.locator('#cloudStatusBadge [data-ui-icon="cloud-upload"] svg')).toBeVisible();
  await expect(page.locator('#cloudStatusBadge [data-cloud-status-icon]')).toHaveCSS('color','rgb(113, 128, 150)');
  await expect(page.locator('.connection-settings-toggle .ui-sr-only')).toHaveText('連線設定');
  await expect(page.locator('#siteMobileBar [data-home-date]')).toHaveCount(0);
  const title=page.locator('#siteMobileBar .site-mobile-home strong');
  for (const width of [360,820,393]) {
    await page.setViewportSize({width,height:852});
    await expect(title).toBeVisible();
    await expect.poll(()=>title.evaluate(node=>{
      const bounds=node.getBoundingClientRect();
      const bar=node.closest('.site-mobile-bar')!.getBoundingClientRect();
      return Math.abs(bounds.left+bounds.width/2-bar.left-bar.width/2);
    })).toBeLessThanOrEqual(1);
  }
  await page.screenshot({path:testInfo.outputPath('lucide-home-mobile.png')});
  await showMobileSection(page,'tools');
  await expect(page.locator('#siteRightRail [data-ui-icon="list-todo"]')).toBeVisible();
  await expect(page.locator('#siteRightRail [data-ui-icon="book-open-check"]')).toBeVisible();
  await expect(page.locator('#siteRightRail [data-ui-icon="book-open"]')).toBeVisible();
  await expect(page.locator('#siteRightRail [data-ui-icon="calendar-clock"]')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('lucide-tools-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:testInfo.outputPath('lucide-home-desktop.png')});
  await page.locator('.panel').filter({has:page.locator('#importProgress')}).screenshot({path:testInfo.outputPath('flat-import-desktop.png')});
});

test('HTML script policy remains effective when the static host drops custom response headers', async ({ page }) => {
  await page.route('**/gpt.prompt.html',async route=>{
    const response=await route.fetch(); const headers={...response.headers()};
    delete headers['content-security-policy'];
    await route.fulfill({response,headers});
  });
  const response=await page.goto('/gpt.prompt.html');
  expect(response!.headers()['content-security-policy']).toBeUndefined();
  await expect(page.locator('meta[data-site-csp]')).toHaveCount(1);
  await page.evaluate(()=>{ const script=document.createElement('script');script.textContent='document.documentElement.dataset.inlineEscaped="yes"';document.body.append(script); });
  await expect(page.locator('html')).not.toHaveAttribute('data-inline-escaped');
  await expect(page.getByRole('button',{name:'複製完整 Prompt',exact:true})).toBeEnabled();
});
