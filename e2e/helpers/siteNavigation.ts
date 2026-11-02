import type { Page } from '@playwright/test';
export async function navigateSite(page: Page, destination: string): Promise<void> {
    const summary = destination === 'summary.html';
    const rail = page.locator(summary ? '.site-rail-left' : '.site-rail-right');
    if (!await rail.isVisible())
        await page.locator(`[data-open-rail="${summary ? 'left' : 'right'}"]`).click();
    await rail.locator(`a[href="./${destination}"]`).click();
}
export async function goHome(page: Page): Promise<void> { await navigateSite(page, 'index.html'); }
