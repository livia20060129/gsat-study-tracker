import { expect, test } from '@playwright/test';

const pageErrors = new WeakMap<object, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => { errors.push(error.message); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '每日讀書完成度紀錄卡' })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

test('mixed writing and timed mock on one date require a persisted exclusive choice', async ({ page }) => {
  await page.locator('#studyDate').fill('2026-09-25');
  await page.locator('#studyDate').dispatchEvent('change');
  const choice = page.locator('#englishTaskChoice');
  await expect(choice).toBeVisible();
  await expect(page.locator('#dailyItemList .item-title', { hasText: '英文：混合題與作文練習' })).toHaveCount(0);
  await expect(page.locator('#dailyItemList .item-title', { hasText: '英文歷屆／模考：限時作答' })).toHaveCount(0);

  await choice.locator('[data-english-task-choice="mock"]').click();
  await expect(page.locator('#dailyItemList .item-title', { hasText: '英文歷屆／模考：限時作答' })).toHaveCount(1);
  await expect(page.locator('#dailyItemList .item-title', { hasText: '英文：混合題與作文練習' })).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('study-v11:guest:2026-09-25') || '{}').englishTaskChoice)).toBe('mock');

  await page.reload();
  await page.locator('#studyDate').fill('2026-09-25');
  await page.locator('#studyDate').dispatchEvent('change');
  await expect(choice.locator('[data-english-task-choice="mock"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#studyDate').fill('2026-09-26');
  await page.locator('#studyDate').dispatchEvent('change');
  await expect(page.locator('#dailyItemList .item-title', { hasText: '英文歷屆／模考：批改與訂正' })).toHaveCount(1);
  const correction = page.locator('#dailyItemList [data-item="preset-2026-09-26-sat_mock_correction"]');
  await correction.locator('[data-minutes]').fill('25');
  await correction.locator('[data-minutes]').blur();

  await page.locator('#studyDate').fill('2026-09-25');
  await page.locator('#studyDate').dispatchEvent('change');
  await choice.locator('[data-english-task-choice="mixed"]').click();
  await expect(page.locator('#dailyItemList .item-title', { hasText: '英文：混合題與作文練習' })).toHaveCount(1);
  await expect(page.locator('#dailyItemList .item-title', { hasText: '英文歷屆／模考：限時作答' })).toHaveCount(0);
  await page.locator('#studyDate').fill('2026-09-26');
  await page.locator('#studyDate').dispatchEvent('change');
  await expect(page.locator('#dailyItemList .item-title', { hasText: '英文歷屆／模考：批改與訂正' })).toHaveCount(0);
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('study-v11:guest:2026-09-26') || '{}').items.find((item: { presetKey: string }) => item.presetKey === 'sat_mock_correction'));
  expect(retained.minutes).toBe('25');
  expect(retained.f.englishMockCorrectionInactive).toBe(true);

  await page.locator('#studyDate').fill('2026-09-25');
  await page.locator('#studyDate').dispatchEvent('change');
  await choice.locator('[data-english-task-choice="mock"]').click();
  await page.locator('#studyDate').fill('2026-09-26');
  await page.locator('#studyDate').dispatchEvent('change');
  await expect(correction.locator('[data-minutes]')).toHaveValue('25');
});

test('both math page panels stay vertically centered and left aligned with settlement metrics', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await page.locator('#studyDate').fill('2026-09-20');
  await page.locator('#studyDate').dispatchEvent('change');
  await expect(page.locator('#settlementMetrics')).toBeVisible();

  for (const view of ['mathToday', 'mathWeek']) {
    await page.locator(`[data-overview-metric="${view}"]`).click();
    const panel = page.locator(`[data-metric-panel="${view}"]`);
    await expect(panel).toHaveClass(/is-active/);
    await page.waitForTimeout(480);
    const position = await panel.evaluate(node => {
      const panelRect = node.getBoundingClientRect();
      const stageRect = node.parentElement!.getBoundingClientRect();
      const cardRect = node.closest('.overview-metric-stat')!.getBoundingClientRect();
      const children = Array.from(node.children).map(child => child.getBoundingClientRect());
      const contentTop = Math.min(...children.map(rect => rect.top));
      const contentBottom = Math.max(...children.map(rect => rect.bottom));
      return {
        centerDifference: Math.abs((contentTop + contentBottom) / 2 - (panelRect.top + panelRect.bottom) / 2),
        stageBottomGap: Math.abs(stageRect.bottom - (cardRect.bottom - 12)),
        leftDifference: Math.abs(children[0].left - (panelRect.left + 5)),
      };
    });
    expect(position.centerDifference).toBeLessThan(3);
    expect(position.stageBottomGap).toBeLessThan(3);
    expect(position.leftDifference).toBeLessThan(3);
  }
});

test('outside status keeps the daily schedule visible', async ({ page }) => {
  await page.locator('#studyDate').fill('2026-09-16');
  await page.locator('#studyDate').dispatchEvent('change');
  const scheduledCards = page.locator('#dailyItemList .item');
  const countBefore = await scheduledCards.count();
  expect(countBefore).toBeGreaterThan(0);

  await page.locator('#mood').selectOption({ label: '外出' });
  await expect(scheduledCards).toHaveCount(countBefore);
  await expect(page.locator('#dailyNotice')).toContainText('原有排程仍保留');
  await expect(page.locator('#dailyNotice')).toContainText('不列入週／月完成率');
});

test('whole-card deletion requires confirmation and small-row deletion can be undone', async ({ page }) => {
  await page.selectOption('#itemType', 'extra');
  await page.click('#addItemBtn');
  const customDelete = page.locator('#itemList [data-action="delete-item"]');
  await expect(customDelete).toHaveCount(1);

  page.once('dialog', dialog => dialog.dismiss());
  await customDelete.click();
  await expect(customDelete).toHaveCount(1);

  page.once('dialog', dialog => dialog.accept());
  await customDelete.click();
  await expect(customDelete).toHaveCount(0);

  await page.click('#addEnglishReviewBtn');
  await page.click('[data-action="word-add"]');
  const wordInput = page.locator('[data-word-text]');
  await wordInput.fill('regression');
  await page.click('[data-action="word-delete"]');
  await expect(page.locator('#deleteUndoToast')).toBeVisible();
  await page.click('#deleteUndoBtn');
  await expect(wordInput).toHaveValue('regression');
});

test('account recovery controls are readable without changing data', async ({ page }) => {
  await page.locator('#connectionSettings > summary').click();
  await expect(page.getByRole('button', { name: '忘記密碼' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重寄驗證信' })).toBeVisible();
  await page.getByRole('button', { name: '忘記密碼' }).click();
  await expect(page.locator('#cloudMessage')).toContainText('請先輸入');
});

test('mobile connection settings stay anchored to their scrolled position', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  const openingFrame = await page.evaluate(() => {
    const settings = document.querySelector<HTMLDetailsElement>('#connectionSettings')!;
    const nextPanel = document.querySelector<HTMLElement>('.panel')!;
    window.scrollTo(0, Math.min(520, document.documentElement.scrollHeight - window.innerHeight));
    const scrollTop = window.scrollY;
    const collapsedRect = settings.getBoundingClientRect();
    const nextPanelTop = nextPanel.getBoundingClientRect().top;
    settings.querySelector<HTMLElement>(':scope > summary')!.click();
    const preparingRect = settings.getBoundingClientRect();
    return {
      backgroundShift: nextPanel.getBoundingClientRect().top - nextPanelTop,
      collapsedHeight: collapsedRect.height,
      collapsedTop: collapsedRect.top,
      preparing: settings.classList.contains('is-preparing'),
      preparingHeight: preparingRect.height,
      preparingTop: preparingRect.top,
      scrollTop,
      scrollTopAfterOpen: window.scrollY,
    };
  });
  expect(openingFrame.scrollTop).toBeGreaterThan(0);
  expect(openingFrame.scrollTopAfterOpen).toBe(openingFrame.scrollTop);
  expect(Math.abs(openingFrame.backgroundShift)).toBeLessThan(1);
  expect(openingFrame.preparing).toBe(true);
  expect(Math.abs(openingFrame.preparingTop - openingFrame.collapsedTop)).toBeLessThan(1);
  expect(Math.abs(openingFrame.preparingHeight - openingFrame.collapsedHeight)).toBeLessThan(1);
  await expect(page.locator('#connectionSettings')).toHaveAttribute('open', '');
  expect(await page.locator('#connectionSettings').evaluate(node => getComputedStyle(node).position)).toBe('fixed');
  await expect(page.locator('.connection-dock-placeholder')).toHaveClass(/is-active/);
  await expect(page.locator('body')).toHaveClass(/connection-sheet-open/);
  expect(await page.locator('body').evaluate(node => getComputedStyle(node).overflowY)).not.toBe('hidden');
  await expect(page.locator('#connectionSettings')).not.toHaveClass(/is-opening/);
  expect(await page.evaluate(() => window.scrollY)).toBe(openingFrame.scrollTop);
  const settledTop = await page.locator('#connectionSettings').evaluate(node => node.getBoundingClientRect().top);
  expect(Math.abs(settledTop - openingFrame.collapsedTop)).toBeLessThan(1);
  await page.locator('#cloudMessage').evaluate((node) => {
    node.textContent = '連線狀態更新後顯示的較長說明文字。'.repeat(18);
  });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const updatedTop = await page.locator('#connectionSettings').evaluate(node => node.getBoundingClientRect().top);
  expect(Math.abs(updatedTop - settledTop)).toBeLessThan(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(openingFrame.scrollTop);
  await page.locator('#connectionSettings > summary').click();
  await expect(page.locator('#connectionSettings')).toHaveClass(/is-closing/);
  await page.waitForTimeout(120);
  const closingTop = await page.locator('#connectionSettings').evaluate(node => node.getBoundingClientRect().top);
  expect(Math.abs(closingTop - openingFrame.collapsedTop)).toBeLessThan(1);
  await expect(page.locator('#connectionSettings')).not.toHaveAttribute('open', '');
  const collapsedTopAfterClose = await page.locator('#connectionSettings').evaluate(
    node => node.getBoundingClientRect().top,
  );
  expect(Math.abs(collapsedTopAfterClose - openingFrame.collapsedTop)).toBeLessThan(1);
  await expect(page.locator('.connection-dock-placeholder')).not.toHaveClass(/is-active/);
  await expect(page.locator('body')).not.toHaveClass(/connection-sheet-open/);
  expect(await page.evaluate(() => window.scrollY)).toBe(openingFrame.scrollTop);
  await context.close();
});

test('connection settings visibly retract before the details element closes', async ({ page }) => {
  const settings = page.locator('#connectionSettings');
  const collapsedHeight = await settings.evaluate(node => node.getBoundingClientRect().height);
  await settings.locator(':scope > summary').click();
  await expect(settings).toHaveAttribute('open', '');
  await expect(settings).toHaveClass(/is-opening/);
  await page.waitForTimeout(120);
  const openingHeight = await settings.evaluate(node => node.getBoundingClientRect().height);
  expect(openingHeight).toBeGreaterThan(collapsedHeight + 8);
  await expect(settings).not.toHaveClass(/is-opening/);
  const expandedHeight = await settings.evaluate(node => node.getBoundingClientRect().height);

  await settings.locator(':scope > summary').click();
  await expect(settings).toHaveClass(/is-closing/);
  await page.waitForTimeout(120);
  const retractingHeight = await settings.evaluate(node => node.getBoundingClientRect().height);
  expect(retractingHeight).toBeLessThan(expandedHeight - 8);
  await expect(settings).not.toHaveAttribute('open', '');
});

test('typed record fields write to storage only after leaving the field', async ({ page }) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__trackerStorageWrites = 0;
    Storage.prototype.setItem = function (key: string, value: string) {
      (window as any).__trackerStorageWrites += 1;
      return original.call(this, key, value);
    };
  });

  const notes = page.locator('#notes');
  await notes.fill('離開欄位後才儲存');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__trackerStorageWrites)).toBe(0);

  await notes.blur();
  await expect.poll(() => page.evaluate(() => (window as any).__trackerStorageWrites)).toBeGreaterThan(0);

  await page.click('#addEnglishReviewBtn');
  await page.click('[data-action="word-add"]');
  await page.evaluate(() => { (window as any).__trackerStorageWrites = 0; });
  const wordInput = page.locator('[data-word-text]').last();
  await wordInput.fill('save on blur');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__trackerStorageWrites)).toBe(0);

  await wordInput.blur();
  await expect.poll(() => page.evaluate(() => (window as any).__trackerStorageWrites)).toBeGreaterThan(0);
});

test('routine switch preserves drafts, saves on blur, and stays fixed-height on mobile', async ({ page }) => {
  const date = await page.locator('#studyDate').inputValue();
  await page.goto('/summary.html');
  await page.evaluate(({ date }) => {
    const prefix = 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(`${prefix}${date}`, JSON.stringify({ schemaVersion: 1, date, wakeTime: '07:20', items: [] }));
  }, { date });
  await page.goto('/');
  await expect(page.locator('#wakeHour')).toHaveValue(/0?7/);
  await expect(page.locator('#wakeMinute')).toHaveValue('20');
  await expect(page.locator('#routineTimeSummary')).toHaveCount(0);
  await expect(page.locator('#wakeHour')).not.toHaveAttribute('placeholder');
  await expect(page.locator('#wakeMinute')).not.toHaveAttribute('placeholder');

  const centeredFieldOffsets = await page.locator('.today-info-centered-field').evaluateAll(nodes => nodes.map(node => {
    const field = node.getBoundingClientRect();
    const label = node.querySelector('label')?.getBoundingClientRect();
    const control = node.querySelector('input, select')?.getBoundingClientRect();
    if (!label || !control) return Number.POSITIVE_INFINITY;
    const contentCenter = (label.top + control.bottom) / 2;
    const fieldCenter = (field.top + field.bottom) / 2;
    return Math.abs(contentCenter - fieldCenter);
  }));
  expect(centeredFieldOffsets).toHaveLength(2);
  expect(centeredFieldOffsets.every(offset => offset < 3)).toBe(true);

  const inputStageBounds = await page.locator('#routineTimeField').evaluate(node => {
    const stage = node.querySelector('.routine-time-input-stage')?.getBoundingClientRect();
    const inputs = Array.from(node.querySelectorAll<HTMLInputElement>('.routine-time-inputs input')).map(input => input.getBoundingClientRect());
    return {
      stageTop: stage?.top ?? 0,
      stageBottom: stage?.bottom ?? 0,
      inputs: inputs.map(input => ({ top: input.top, bottom: input.bottom })),
    };
  });
  expect(inputStageBounds.inputs).toHaveLength(2);
  expect(
    inputStageBounds.inputs.every(input => input.top >= inputStageBounds.stageTop && input.bottom <= inputStageBounds.stageBottom),
    JSON.stringify(inputStageBounds),
  ).toBe(true);
  const routineBottomGap = await page.locator('#routineTimeField').evaluate(node => {
    const field = node.getBoundingClientRect();
    const stage = node.querySelector('.routine-time-input-stage')?.getBoundingClientRect();
    return field.bottom - (stage?.bottom ?? field.bottom);
  });
  expect(routineBottomGap).toBeLessThan(15);

  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as any).__routineStorageWrites = 0;
    Storage.prototype.setItem = function (key: string, value: string) {
      (window as any).__routineStorageWrites += 1;
      return original.call(this, key, value);
    };
  });
  await page.locator('#wakeHour').fill('8');
  await page.locator('[data-routine-mode="bedtime"]').dispatchEvent('click');
  expect(await page.evaluate(() => (window as any).__routineStorageWrites)).toBe(0);
  await page.locator('#wakeHour').fill('1');
  await page.locator('#wakeMinute').fill('30');
  await expect(page.locator('#routineNextDayHint')).toBeVisible();
  await page.locator('[data-routine-mode="wake"]').dispatchEvent('click');
  await expect(page.locator('#wakeHour')).toHaveValue('8');
  await expect(page.locator('#wakeMinute')).toHaveValue('20');
  await page.locator('[data-routine-mode="bedtime"]').dispatchEvent('click');
  await expect(page.locator('#wakeHour')).toHaveValue('1');
  await expect(page.locator('#wakeMinute')).toHaveValue('30');
  await page.locator('#wakeMinute').blur();
  await expect.poll(() => page.evaluate(() => (window as any).__routineStorageWrites)).toBeGreaterThan(0);

  const stored = await page.evaluate(({ date }) => JSON.parse(localStorage.getItem(`study-v11:guest:${date}`) || '{}'), { date });
  expect(stored.wakeTime).toBe('08:20');
  expect(stored.bedtime).toEqual({ time: '01:30', dateTime: expect.stringMatching(/T01:30$/), nextDay: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const beforeHeight = await page.locator('#routineTimeField').evaluate(node => node.getBoundingClientRect().height);
  await page.locator('[data-routine-mode="wake"]').click();
  await page.waitForTimeout(280);
  const afterHeight = await page.locator('#routineTimeField').evaluate(node => node.getBoundingClientRect().height);
  expect(Math.abs(afterHeight - beforeHeight)).toBeLessThan(1);

  const dateContainment = await page.locator('#studyDate').evaluate(node => {
    const input = node.getBoundingClientRect();
    const field = node.closest('.today-info-centered-field')?.getBoundingClientRect();
    return {
      inputLeft: input.left,
      inputRight: input.right,
      fieldLeft: field?.left ?? 0,
      fieldRight: field?.right ?? 0,
    };
  });
  expect(dateContainment.inputLeft).toBeGreaterThanOrEqual(dateContainment.fieldLeft);
  expect(dateContainment.inputRight).toBeLessThanOrEqual(dateContainment.fieldRight);
});

test('cloud conflict prompt names the card, field, and both values', async ({ page }) => {
  const date = '2026-09-20';
  await page.goto('/summary.html');
  await page.evaluate(({ date }) => {
    const prefix = 'study-v11:guest:';
    const local = {
      date,
      items: [{
        id: 'conflict-math', type: 'mathStudy', title: '數學講義：進度',
        done: false, minutes: '25', required: true, f: { material: '新關鍵', book: '1~2' },
      }],
    };
    const cloud = structuredClone(local);
    cloud.items[0].minutes = '40';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(`${prefix}${date}`, JSON.stringify({
      ...local,
      schemaVersion: 1,
      localDirty: true,
      syncConflict: true,
      syncConflictLocal: local,
      syncConflictCloud: cloud,
      syncConflictDetails: [{
        path: '$.items[id:conflict-math].minutes', kind: 'same-field',
        baseExists: true, localExists: true, cloudExists: true,
        base: '15', local: '25', cloud: '40',
      }],
    }));
  }, { date });
  await page.goto('/');
  await page.locator('#studyDate').fill(date);
  await page.locator('#studyDate').dispatchEvent('change');
  await page.locator('#connectionSettings > summary').click();

  await expect(page.locator('#cloudConflictText')).toContainText('數學講義：進度 › 讀書時間（分鐘）');
  await expect(page.locator('#cloudConflictDetails')).toContainText('本機：25');
  await expect(page.locator('#cloudConflictDetails')).toContainText('雲端：40');
  await expect(page.getByRole('button', { name: '以本機整日紀錄覆蓋雲端' })).toBeVisible();
  await expect(page.getByRole('button', { name: '以雲端整日紀錄取代本機' })).toBeVisible();
});

test('timer starts from the closest second represented by manual minutes', async ({ page }) => {
  await page.selectOption('#itemType', 'extra');
  await page.click('#addItemBtn');
  const card = page.locator('#itemList [data-item]').filter({ has: page.locator('[data-action="delete-item"]') }).last();
  const minutes = card.locator('[data-minutes]');
  await minutes.fill('12.5');
  await minutes.blur();
  const modeSegments = card.locator('.time-mode-segments');
  await modeSegments.evaluate(node => { node.setAttribute('data-animation-probe', 'original'); });
  await card.locator('[data-action="time-mode-select"][data-time-mode="timer"]').click();
  await expect(modeSegments).toHaveAttribute('data-active', '1');
  await expect(modeSegments).toHaveAttribute('data-animation-probe', 'original');
  await expect(card.locator('[data-timer-display]')).toHaveText('12:30');
  await expect(modeSegments).not.toHaveAttribute('data-animation-probe', 'original');
});

test('completing deferred work records its date and checks the original day', async ({ page }) => {
  await page.goto('about:blank');
  await page.clock.install({ time: new Date('2026-09-17T12:00:00+08:00') });
  await page.goto('/');
  await page.evaluate(() => {
    const prefix = 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(`${prefix}2026-09-16`, JSON.stringify({
      schemaVersion: 1,
      date: '2026-09-16',
      items: [{
        id: 'deferred-origin',
        type: 'general',
        title: '延期同步測試',
        done: false,
        minutes: '',
        required: true,
        source: 'preset',
        presetKey: 'e2e_deferred_source',
        deferred: true,
        deferredTargetDay: 4,
        f: {},
      }],
    }));
  });
  await page.reload();

  const deferredCard = page.locator('#dailyItemList [data-item]').filter({ hasText: '延期同步測試' });
  await expect(deferredCard).toHaveCount(1);
  const checkbox = deferredCard.locator('[data-done]').first();
  await checkbox.check();
  const completionDate = deferredCard.locator('[data-completion-date]');
  await expect(completionDate.locator('xpath=..')).toContainText('完成日期');
  await expect(completionDate).toHaveValue('2026-09-17');
  const completionDatePosition = await deferredCard.evaluate(node => {
    const title = node.querySelector('.item-title')?.getBoundingClientRect();
    const editor = node.querySelector('.completion-date-editor')?.getBoundingClientRect();
    return { titleBottom: title?.bottom ?? 0, editorTop: editor?.top ?? 0 };
  });
  expect(completionDatePosition.editorTop).toBeGreaterThanOrEqual(completionDatePosition.titleBottom);
  await completionDate.fill('2026-09-18');
  await completionDate.blur();
  await expect(deferredCard.locator('[data-completion-date]')).toHaveValue('2026-09-18');

  const completedOrigin = await page.evaluate(() => JSON.parse(localStorage.getItem('study-v11:guest:2026-09-16') || '{}').items.find((item: { id: string }) => item.id === 'deferred-origin'));
  expect(completedOrigin.done).toBe(true);
  expect(completedOrigin.checkedOn).toBe('2026-09-18');
  expect(completedOrigin.deferredCompletedOn).toBe('2026-09-18');

  await page.reload();
  await expect(page.locator('#dailyItemList [data-item]').filter({ hasText: '延期同步測試' }).locator('[data-done]').first()).toBeChecked();

  await page.locator('#dailyItemList [data-item]').filter({ hasText: '延期同步測試' }).locator('[data-done]').first().uncheck();
  const restoredOrigin = await page.evaluate(() => JSON.parse(localStorage.getItem('study-v11:guest:2026-09-16') || '{}').items.find((item: { id: string }) => item.id === 'deferred-origin'));
  expect(restoredOrigin.done).toBe(false);
  expect(restoredOrigin.checkedOn).toBeUndefined();
  expect(restoredOrigin.deferredCompletedOn).toBeUndefined();
});

test('ordinary completion is written immediately and survives reload', async ({ page }) => {
  await page.goto('about:blank');
  await page.clock.install({ time: new Date('2026-09-20T12:00:00+08:00') });
  await page.goto('/summary.html');
  await page.evaluate(() => {
    const prefix = 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(`${prefix}2026-09-20`, JSON.stringify({ schemaVersion: 2, date: '2026-09-20', wakeTime: '06:30', items: [] }));
  });
  await page.goto('/');

  const card = page.locator('#dailyItemList [data-item]').first();
  const itemId = await card.getAttribute('data-item');
  const checkbox = card.locator('[data-done]').first();
  await page.locator('#wakeMinute').fill('');
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  const completionDate = card.locator('[data-completion-date]');
  await expect(completionDate).toHaveValue('2026-09-20');
  await completionDate.fill('2026-09-19');
  await completionDate.blur();
  const completionDatePosition = await card.evaluate(node => {
    const title = node.querySelector('.item-title')?.getBoundingClientRect();
    const note = node.querySelector('.item-desc')?.getBoundingClientRect();
    const editor = node.querySelector('.completion-date-editor')?.getBoundingClientRect();
    return { contentBottom: Math.max(title?.bottom ?? 0, note?.bottom ?? 0), editorTop: editor?.top ?? 0 };
  });
  expect(completionDatePosition.editorTop).toBeGreaterThanOrEqual(completionDatePosition.contentBottom);

  const stored = await page.evaluate(id => {
    const record = JSON.parse(localStorage.getItem('study-v11:guest:2026-09-20') || '{}');
    return { wakeTime: record.wakeTime, item: record.items.find((entry: { id: string }) => entry.id === id) };
  }, itemId);
  expect(stored.item.done).toBe(true);
  expect(stored.item.checkedOn).toBe('2026-09-19');
  expect(stored.wakeTime).toBe('06:30');

  await page.reload();
  await expect(page.locator(`#dailyItemList [data-item="${itemId}"] [data-done]`).first()).toBeChecked();
  await expect(page.locator(`#dailyItemList [data-item="${itemId}"] [data-completion-date]`)).toHaveValue('2026-09-19');
});

test('Calendar-backed math completion survives navigating to its completion date and back', async ({ page }) => {
  await page.goto('about:blank');
  await page.clock.install({ time: new Date('2026-09-20T12:00:00+08:00') });
  await page.goto('/');
  await page.evaluate(() => {
    const prefix = 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(`${prefix}2026-09-16`, JSON.stringify({
      schemaVersion: 2,
      date: '2026-09-16',
      items: [{
        id: 'calendar-new-key-math',
        type: 'mathStudy',
        done: true,
        checkedOn: '2026-09-18',
        minutes: '49.3',
        required: true,
        source: 'custom',
        presetKey: 'calendar-new-key-math',
        title: '數學講義：進度',
        description: 'Google Calendar API：新關鍵',
        f: { material: '新關鍵', book: '1~2', start: '10', end: '13' },
      }],
    }));
  });
  await page.reload();

  const studyDate = page.locator('#studyDate');
  await studyDate.fill('2026-09-16');
  await studyDate.dispatchEvent('change');
  const groupedMathParent = page.locator('#dailyItemList > [data-item]').filter({ hasText: '數學講義：進度' }).first();
  const groupedMathChildren = groupedMathParent.locator(':scope > .inner > [data-item]');
  await expect(groupedMathChildren).toHaveCount(2);
  const mathCard = groupedMathChildren.last();
  const itemId = await mathCard.getAttribute('data-item');
  expect(itemId).not.toBeNull();
  await mathCard.locator('[data-minutes]').fill('51.8');
  await mathCard.locator('[data-minutes]').blur();
  await mathCard.locator('[data-done]').first().check();
  const completionDate = mathCard.locator('[data-completion-date]').first();
  await completionDate.fill('2026-09-19');
  await completionDate.blur();

  await studyDate.fill('2026-09-19');
  await studyDate.dispatchEvent('change');
  await studyDate.fill('2026-09-16');
  await studyDate.dispatchEvent('change');

  const restoredCard = page.locator(`#dailyItemsView [data-item="${itemId}"]`).last();
  await expect(restoredCard.locator('[data-done]').first()).toBeChecked();
  await expect(restoredCard.locator('[data-completion-date]').first()).toHaveValue('2026-09-19');
  await expect(restoredCard.locator('[data-minutes]').first()).toHaveValue('51.8');
});

test('completion on another date survives stale-tab navigation to that date and back', async ({ page, context }) => {
  await page.goto('about:blank');
  await page.clock.install({ time: new Date('2026-08-19T12:00:00+08:00') });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('study-v11:meta:active-record-prefix', 'study-v11:guest:');
  });
  await page.reload();

  const studyDate = page.locator('#studyDate');
  await studyDate.fill('2026-08-16');
  await studyDate.dispatchEvent('change');
  const itemId = await page.locator('#dailyItemsView [data-item] [data-done]').first().evaluate(input => (
    input.closest('[data-item]')?.getAttribute('data-item') || ''
  ));
  expect(itemId).not.toBe('');

  const writer = await context.newPage();
  await writer.goto('/');
  const writerDate = writer.locator('#studyDate');
  await writerDate.fill('2026-08-16');
  await writerDate.dispatchEvent('change');
  const writerCard = writer.locator(`#dailyItemsView [data-item="${itemId}"]`);
  await writerCard.locator('[data-done]').first().check();
  const completionDate = writerCard.locator('[data-completion-date]').first();
  await completionDate.fill('2026-08-19');
  await completionDate.blur();
  await expect(writerCard.locator('[data-done]').first()).toBeChecked();

  // The first page still holds the old unchecked snapshot. Navigating it must
  // merge the newer stored completion instead of writing that snapshot back.
  await studyDate.fill('2026-08-19');
  await studyDate.dispatchEvent('change');
  await expect(studyDate).toHaveValue('2026-08-19');

  await writerDate.fill('2026-08-19');
  await writerDate.dispatchEvent('change');
  await writerDate.fill('2026-08-16');
  await writerDate.dispatchEvent('change');

  await expect(writer.locator(`#dailyItemsView [data-item="${itemId}"] [data-done]`).first()).toBeChecked();
  await expect(writer.locator(`#dailyItemsView [data-item="${itemId}"] [data-completion-date]`).first()).toHaveValue('2026-08-19');
  const stored = await writer.evaluate(id => {
    const record = JSON.parse(localStorage.getItem('study-v11:guest:2026-08-16') || '{}');
    return record.items.find((entry: { id: string }) => entry.id === id);
  }, itemId);
  expect(stored.done).toBe(true);
  expect(stored.checkedOn).toBe('2026-08-19');
  await writer.close();
});

test('interactive child completion is written immediately and survives reload', async ({ page }) => {
  await page.goto('about:blank');
  await page.clock.install({ time: new Date('2026-09-21T12:00:00+08:00') });
  await page.goto('/summary.html');
  await page.evaluate(() => {
    const prefix = 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(`${prefix}2026-09-21`, JSON.stringify({ schemaVersion: 2, date: '2026-09-21', items: [] }));
  });
  await page.goto('/');

  const card = page.locator('#dailyItemList [data-item="monday-vocab-2026-09-21"]');
  const itemId = await card.getAttribute('data-item');
  const checkbox = card.locator('[data-done]').first();
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await expect(card.locator('[data-completion-date]')).toHaveValue('2026-09-21');
  const completionDatePosition = await card.evaluate(node => {
    const title = node.querySelector('.fixed-book-value')?.getBoundingClientRect();
    const note = node.querySelector('.field > .small')?.getBoundingClientRect();
    const editor = node.querySelector('.completion-date-editor')?.getBoundingClientRect();
    return { contentBottom: Math.max(title?.bottom ?? 0, note?.bottom ?? 0), editorTop: editor?.top ?? 0 };
  });
  expect(completionDatePosition.editorTop).toBeGreaterThanOrEqual(completionDatePosition.contentBottom);

  const stored = await page.evaluate(id => {
    const record = JSON.parse(localStorage.getItem('study-v11:guest:2026-09-21') || '{}');
    const stack = [...(record.items || [])];
    while (stack.length) {
      const item = stack.shift();
      if (item?.id === id) return item;
      for (const value of Object.values(item?.f || {})) if (Array.isArray(value)) stack.push(...value);
    }
    return null;
  }, itemId);
  expect(stored?.done).toBe(true);

  await page.reload();
  await expect(page.locator(`#dailyItemList [data-item="${itemId}"] [data-done]`).first()).toBeChecked();
});

test('learning summary uses one week/month control for the complete page', async ({ page }) => {
  // Leave the record editor first: its pagehide handler deliberately persists
  // the current form and would otherwise overwrite this isolated fixture.
  await page.goto('/summary.html');
  await page.evaluate(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const previous = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
    const previousDate = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-${String(previous.getDate()).padStart(2, '0')}`;
    const prefix = 'study-v11:guest:';
    localStorage.setItem('study-v11:meta:active-record-prefix', prefix);
    localStorage.setItem(`${prefix}${previousDate}`, JSON.stringify({
      schemaVersion: 2,
      date: previousDate,
      bedtime: { time: '23:45', dateTime: `${previousDate}T23:45`, nextDay: false },
      items: [],
    }));
    localStorage.setItem(`${prefix}${date}`, JSON.stringify({
      schemaVersion: 2,
      date,
      wakeTime: '06:30',
      items: [
        { id: 'summary-math', type: 'mathStudy', done: true, minutes: '45', required: true, source: 'preset', f: { subject: '數學' } },
        { id: 'summary-english', type: 'englishPractice', title: '英文閱讀', done: true, minutes: '15', required: true, source: 'preset', f: { subject: '英文' } },
        { id: 'summary-english-listening', type: 'englishPractice', title: '英文聽力', done: true, minutes: '15', required: true, source: 'preset', f: { subject: '英文' } },
        { id: 'summary-english-writing', type: 'englishPractice', title: '英文寫作', done: true, minutes: '15', required: true, source: 'preset', f: { subject: '英文' } },
        { id: 'summary-english-grammar', type: 'englishPractice', title: '英文文法', done: true, minutes: '15', required: true, source: 'preset', f: { subject: '英文' } },
        { id: 'summary-english-vocabulary', type: 'englishPractice', title: '英文單字', done: true, minutes: '15', required: true, source: 'preset', f: { subject: '英文' } },
        { id: 'summary-physics', type: 'scienceReview', title: '物理｜運動', done: true, minutes: '10', required: true, source: 'preset', f: { subject: '物理' } },
        { id: 'summary-physics-force', type: 'scienceReview', title: '物理｜力學', done: true, minutes: '10', required: true, source: 'preset', f: { subject: '物理' } },
        { id: 'summary-chemistry', type: 'scienceReview', title: '化學｜反應', done: true, minutes: '20', required: true, source: 'preset', f: { subject: '化學' } },
        { id: 'summary-biology', type: 'biologyInteractive', title: '生物｜細胞', done: true, minutes: '30', required: true, source: 'preset', f: { subject: '生物' } },
        { id: 'summary-earth', type: 'scienceReview', title: '地科｜地質', done: true, minutes: '40', required: true, source: 'preset', f: { subject: '地科' } },
      ],
    }));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '週／月總結' })).toBeVisible();
  await expect(page.locator('#summaryModeSwitch')).toHaveCount(1);
  await expect(page.locator('#summaryCalendar .summary-day')).toHaveCount(7);
  await expect(page.locator('#calendarTitle')).toHaveText('週曆');
  await expect(page.locator('#personalStatusPeriod')).toHaveText('本週作息統計');
  await expect(page.locator('#averageWakeTime')).toHaveText('06:30');
  await expect(page.locator('#validSleepCount')).toContainText('1／7 晚');
  await expect(page.locator('#sleepTrend')).toBeVisible();
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center strong')).toHaveText('3.8');
  await expect(page.locator('#summarySubjectDistribution .summary-donut-center span')).toHaveText('hr');
  await page.locator('#summaryCalendar .summary-day.has-record [data-summary-day]').last().click();
  await expect(page.locator('#summaryCalendar .summary-day.is-tooltip-open .summary-day-tooltip')).toContainText('學習時間');
  await expect(page.locator('#summaryCalendar .summary-day.is-tooltip-open .summary-day-tooltip')).toContainText('完成率');
  await expect.poll(() => page.locator('#summaryCalendar .summary-day.is-tooltip-open .summary-day-tooltip').evaluate(node => getComputedStyle(node).opacity)).toBe('1');
  await page.locator('[data-summary-subject="英文"]').click();
  await expect(page.locator('#subjectTitle')).toHaveText('科目分配｜英文');
  await expect(page.locator('#summarySubjectDistribution .summary-subject-detail-name')).toHaveCount(5);
  const detailPositions = await page.locator('#summarySubjectDistribution .summary-subject-detail-name').evaluateAll(nodes => nodes.map(node => {
    const rect = node.closest('li')?.getBoundingClientRect();
    return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
  }));
  for (let index = 1; index < 4; index += 1) {
    expect(Math.abs(detailPositions[index].left - detailPositions[0].left)).toBeLessThan(3);
    expect(detailPositions[index].top).toBeGreaterThan(detailPositions[index - 1].top + 8);
  }
  expect(detailPositions[4].left).toBeGreaterThan(detailPositions[0].left + 8);
  await page.locator('#summarySubjectDistribution [data-summary-back]').first().click();
  await expect(page.locator('#subjectTitle')).toHaveText('科目分配');
  await expect(page.locator('[data-summary-subject="自然"]')).toHaveCount(1);
  await expect(page.locator('[data-summary-subject="物理"], [data-summary-subject="化學"], [data-summary-subject="生物"], [data-summary-subject="地科"]')).toHaveCount(0);
  await page.locator('[data-summary-subject="自然"]').click();
  await expect(page.locator('#subjectTitle')).toHaveText('科目分配｜自然');
  const naturalItems = page.locator('#summarySubjectDistribution .summary-subject-detail-name');
  await expect(naturalItems).toHaveCount(5);
  for (const label of ['物理｜運動', '物理｜力學', '化學｜反應', '生物｜互動題', '地科｜地質']) {
    await expect(naturalItems.filter({ hasText: label })).toHaveCount(1);
  }
  const naturalColors = await page.locator('#summarySubjectDistribution .summary-subject-detail-list i')
    .evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
  expect(new Set(naturalColors).size).toBeGreaterThanOrEqual(4);
  await page.locator('#summarySubjectDistribution [data-summary-back]').first().click();
  await expect(page.locator('#subjectTitle')).toHaveText('科目分配');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHeader = await page.locator('.summary-header').evaluate(node => {
    const heading = node.querySelector('h1')!.getBoundingClientRect();
    const back = node.querySelector('.summary-back')!.getBoundingClientRect();
    const header = node.getBoundingClientRect();
    return {
      headingBottom: heading.bottom,
      headingFontSize: getComputedStyle(node.querySelector('h1')!).fontSize,
      backTop: back.top,
      backWidth: back.width,
      headerWidth: header.width,
    };
  });
  expect(mobileHeader.headingFontSize).toBe('28px');
  expect(mobileHeader.backTop).toBeGreaterThan(mobileHeader.headingBottom);
  expect(Math.abs(mobileHeader.backWidth - mobileHeader.headerWidth)).toBeLessThan(3);
  await page.locator('[data-summary-subject="英文"]').click();
  await expect(page.locator('#summarySubjectDistribution')).toHaveClass(/animate-detail-entry/);
  await page.waitForTimeout(420);
  const mobileDetailLayout = await page.locator('#summarySubjectDistribution').evaluate(node => {
    const donut = node.querySelector('.summary-donut-shell.is-detail')?.getBoundingClientRect();
    const items = Array.from(node.querySelectorAll('.summary-subject-detail-list li')).map(item => {
      const rect = item.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });
    return { donutRight: donut?.right ?? 0, items };
  });
  expect(mobileDetailLayout.donutRight).toBeLessThan(mobileDetailLayout.items[0].left);
  for (let index = 1; index < 4; index += 1) {
    expect(Math.abs(mobileDetailLayout.items[index].left - mobileDetailLayout.items[0].left)).toBeLessThan(3);
    expect(mobileDetailLayout.items[index].top).toBeGreaterThan(mobileDetailLayout.items[index - 1].top + 8);
  }
  expect(mobileDetailLayout.items[4].left).toBeGreaterThan(mobileDetailLayout.items[0].left + 8);
  await page.locator('#summarySubjectDistribution [data-summary-back]').first().click();
  await expect(page.locator('#subjectTitle')).toHaveText('科目分配');
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.locator('[data-summary-subject="數學"]').click();
  await expect(page.locator('#subjectTitle')).toHaveText('科目分配｜數學');
  await expect(page.locator('#summarySubjectDistribution .summary-subject-detail-name')).toHaveText('講義進度');
  await expect(page.locator('#summaryTrend')).toContainText('hr');

  await page.getByRole('tab', { name: '月' }).click();
  await expect(page.locator('#calendarTitle')).toHaveText('月曆');
  await expect(page.locator('#personalStatusPeriod')).toHaveText('本月作息統計');
  await expect(page.locator('#conclusionTitle')).toHaveText('本月小結');
  await expect(page.locator('#summaryContent')).not.toHaveClass(/is-mode-transitioning/);
  await expect.poll(() => page.locator('#summaryContent').evaluate(node => getComputedStyle(node).opacity)).toBe('1');
  await expect(page.locator('.summary-calendar-weekdays')).toBeVisible();
  await expect(page.locator('#summaryCalendar .summary-day')).toHaveCount(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
  await expect(page.locator('#periodLabel')).toContainText('月');
});
