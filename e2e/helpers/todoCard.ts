import { expect, type Locator } from '@playwright/test';

/** Editors are opened through the same whole-card interaction available to users. */
export async function expandTodoCard(card: Locator): Promise<void> {
  await expect(card).toBeVisible();
  // A visible heading can still move when a clipped parent finishes expanding.
  const movingContainers = card.locator('xpath=ancestor-or-self::*[@data-disclosure-motion]');
  await expect(movingContainers).toHaveCount(0);
  if (await card.getAttribute('data-expanded') === 'false') await card.locator('h3').click();
  await expect(card).toHaveAttribute('data-expanded', 'true');
  await expect(movingContainers).toHaveCount(0);
}
