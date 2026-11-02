import type { Page } from '@playwright/test';
export async function navigateSite(page: Page, destination: string): Promise<void> {
    const summary = destination === 'summary.html';
    const rail = page.locator(summary ? '.site-rail-left' : '.site-rail-right');
    const compact = await page.evaluate(() => matchMedia('(max-width: 1199px)').matches);
    if (compact && await page.locator('body').getAttribute('data-rail') !== (summary ? 'left' : 'right'))
        await page.locator(`[data-open-rail="${summary ? 'left' : 'right'}"]`).click();
    await rail.locator(`a[href="./${destination}"]`).click();
}
export async function goHome(page: Page): Promise<void> { await navigateSite(page, 'index.html'); }

export async function selectStudyDate(page: Page, date: string): Promise<void> {
    const input = page.locator('#studyDate');
    const rail = page.locator('.site-rail-left');
    const compact = await page.evaluate(() => matchMedia('(max-width: 1199px)').matches);
    if (compact && await page.locator('body').getAttribute('data-rail') !== 'left') await page.locator('[data-open-rail="left"]').click();
    await input.fill(date);
    await input.dispatchEvent('change');
    if (await page.locator('body').getAttribute('data-rail') === 'left') {
        await rail.locator('[data-close-rail]').click();
    }
    if (await page.locator('.site-mobile-bar').isVisible()) await rail.waitFor({ state: 'hidden' });
}
