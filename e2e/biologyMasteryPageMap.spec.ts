import { expect, test } from '@playwright/test';
import { BIOLOGY_MASTERY_UPPER_TITLE as title } from '../src/data/naturalMaterialPageMaps.ts';
import { enableMaterialEditing } from './helpers/materialEditing.ts';

test.use({ timezoneId: 'Asia/Taipei' });
for (const viewport of [{ width: 1280, height: 720 }, { width: 375, height: 812 }]) {
  test(`Biology Mastery upper retains its photographed catalog, Tracker references and four-topic progress at ${viewport.width}px`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.clock.install({ time: new Date('2026-11-18T12:00:00+08:00') });
    await page.route('https://arxbirgujbrtzhoficdf.supabase.co/**', route => route.fulfill({ json: [] }));
    await page.goto('/material.progress.html#natural');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:guest:'); });
    await page.reload();
    await page.locator('#catalogSearch').fill('精通');
    const row = page.locator('.material-row').filter({ hasText: title });
    await expect(row).toHaveCount(1); await expect(row.locator('.material-segment')).toHaveCount(4);
    await enableMaterialEditing(page); await row.getByRole('button', { name: '編輯', exact: true }).click();
    await expect(page.locator('#catalogTotal')).toHaveValue('279');
    await expect(page.locator('#catalogSections .catalog-section')).toHaveCount(19);
    await expect(page.locator('#catalogSections .catalog-section').last().locator('[data-section-field="end"]')).toHaveValue('279');
    await page.goto('/index.html?date=2026-11-18');
    await page.locator('#itemType').selectOption('scienceReview'); await page.locator('#addItemBtn').click();
    const card = page.locator('#itemList > [data-item]').last();
    const id = await card.getAttribute('data-item');
    await card.locator('[data-field="subject"]').selectOption('生物');
    await card.locator('[data-field="material"]').selectOption(title);
    await card.locator('[data-field="start"]').fill('204'); await card.locator('[data-field="start"]').blur();
    await card.locator('[data-field="end"]').fill('205');
    await card.locator('[data-field="end"]').blur();
    await expect(card.locator('[data-science-auto]')).toContainText('核酸的構造');
    await expect(card.locator('[data-science-auto]')).toContainText('DNA的構造與複製');
    await card.locator('[data-field="start"]').fill('263'); await card.locator('[data-field="start"]').blur();
    await card.locator('[data-field="end"]').fill('279');
    await card.locator('[data-field="end"]').blur();
    await expect(card.locator('[data-science-auto]')).toContainText('要點六 遺傳學在生物科技的應用');
    await card.locator('[data-check="progress"]').check();
    await page.reload();
    const restored = page.locator(`#itemList [data-item="${id}"]`);
    await expect(restored.locator('[data-field="material"]')).toHaveValue(title);
    await expect(restored.locator('[data-field="start"]')).toHaveValue('263');
    await expect(restored.locator('[data-field="end"]')).toHaveValue('279');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/material.progress.html#natural'); await page.locator('#catalogSearch').fill('精通');
    await expect(row).toContainText('完成 6%'); await expect(row.locator('.material-segment')).toHaveCount(4);
    await page.screenshot({ path: info.outputPath('biology-mastery-upper-page-map.png'), fullPage: true });
  });
}
