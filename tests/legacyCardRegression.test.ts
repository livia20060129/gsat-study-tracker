import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as completion from '../src/study/completionMetrics.ts';
import { isConfirmedDeferred } from '../src/study/deferDays.ts';
import { renderItemDeleteFooter } from '../src/ui/itemActions.ts';
import type { StudyItem, StudyRecord } from '../src/types.ts';

const runtime = readFileSync(new URL('../src/legacy-app.ts', import.meta.url), 'utf8');

// Execute the actual compatibility-runtime functions without starting auth, storage, or the app.
function runtimeFunction<T>(name: string, dependencies: Record<string, unknown>): T {
  const start = runtime.indexOf(`function ${name}(`);
  const end = runtime.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, `Missing runtime function: ${name}`);
  return runInNewContext(`${runtime.slice(start, end)}\n${name}`, dependencies) as T;
}

function item(overrides: Partial<StudyItem> = {}): StudyItem {
  return { id: 'test-item', type: 'extra', title: '英文', required: true, source: 'preset', done: false, minutes: '', f: {}, ...overrides };
}

const recordUnits = runtimeFunction<(record: StudyRecord, date: string) => completion.CompletionUnit[]>(
  'completionUnitsForRecord',
  {
    ...completion,
    data: null,
    visibleItems: (record: StudyRecord) => record.items,
    confirmedDeferred: isConfirmedDeferred,
    isWeeklyCalendarItem: (x: StudyItem) => x.f.calendarRoute === 'week',
    isGroupedWork: (x: StudyItem) => Boolean(x.f.groupedWorkEntries?.length),
    groupedWorkEntries: (x: StudyItem) => x.f.groupedWorkEntries || [],
    isInteractiveDaily: (x: StudyItem) => x.type === 'interactiveDaily',
    ensureInteractiveEntries: (x: StudyItem) => x.f.interactiveEntries || [],
    isCalendarNaturalIntegration: (x: StudyItem) => x.f.calendarNaturalIntegration === true,
    ensureCalendarNaturalIntegrationEntries: (x: StudyItem) => x.f.calendarIntegrationEntries || [],
    isSaturdayMakeup: (x: StudyItem) => x.presetKey === 'sat_makeup',
    isEnglishReview: () => false,
    isCalendarMakeup: (x: StudyItem) => x.f.calendarMakeup === true,
    hasMergedCalendarMakeup: (x: StudyItem) => x.f.calendarIncludesMakeup === true,
  },
);

function metrics(items: StudyItem[]) {
  const record = { date: '2026-09-04', items };
  return completion.summarizeCompletionUnits(recordUnits(record, record.date));
}

test('runtime metrics wait for confirmation, subtract once on retargeting, and restore on cancellation', () => {
  const moving = item({ deferred: true });
  const items = [item({ done: true }), item(), moving];
  assert.equal(metrics(items).itemTotal, 3);
  assert.equal(metrics(items).workloadTotal, 3);
  moving.deferredTargetDay = 6;
  const confirmed = metrics(items);
  assert.equal(confirmed.itemCompleted, 1);
  assert.equal(confirmed.itemTotal, 2);
  assert.equal(confirmed.workloadCompleted, 1);
  assert.equal(confirmed.workloadTotal, 2);
  moving.deferredTargetDay = 0;
  assert.deepEqual(metrics(items), confirmed);
  assert.deepEqual(metrics(JSON.parse(JSON.stringify(items))), confirmed);
  moving.deferred = false;
  assert.equal(metrics(items).itemTotal, 3);
  assert.equal(metrics(items).workloadTotal, 3);
});

test('all runtime card variants exclude confirmed deferrals from both metrics', () => {
  const variants = [
    item(),
    item({ deferredCarry: true }),
    item({ required: false, f: { calendarMakeup: true } }),
    item({ required: false, source: 'custom' }),
    item({ f: { calendarIncludesMakeup: true } }),
    item({ type: 'interactiveDaily', f: { interactiveEntries: [item({ done: true })], calendarIncludesMakeup: true } }),
    item({ type: 'interactiveDaily', deferredCarry: true, f: { interactiveEntries: [item({ done: true })] } }),
    item({ type: 'scienceReview', f: { calendarNaturalIntegration: true, calendarIntegrationEntries: [{ subject: '物理', done: true }, { subject: '生物', done: false }] } }),
    item({ type: 'scienceReview', deferredCarry: true, f: { calendarNaturalIntegration: true, calendarIntegrationEntries: [{ subject: '物理', done: true }] } }),
    item({ type: 'scienceReview', f: { calendarNaturalIntegration: true } }),
    item({ type: 'general', presetKey: 'sat_makeup', f: { makeupEntries: [item({ done: true })] } }),
  ];
  for (const candidate of variants) {
    assert.ok(metrics([candidate]).workloadTotal > 0);
    candidate.deferred = true;
    candidate.deferredTargetDay = 6;
    const result = metrics([candidate]);
    assert.equal(result.itemTotal, 0, JSON.stringify(candidate));
    assert.equal(result.itemCompleted, 0);
    assert.equal(result.workloadTotal, 0);
    assert.equal(result.workloadCompleted, 0);
  }
});

test('runtime grouped original and Calendar makeup children defer independently', () => {
  const parent = item({ f: { groupedWorkEntries: [
    item({ done: true }),
    item({ deferred: true, deferredTargetDay: 6 }),
    item({ required: false, f: { calendarMakeup: true }, deferred: true, deferredTargetDay: 6 }),
    item({ required: false, deferredCarry: true, done: true }),
  ] } });
  const result = metrics([parent]);
  assert.equal(result.itemCompleted, 1);
  assert.equal(result.itemTotal, 1);
  assert.equal(result.workloadCompleted, 2);
  assert.equal(result.workloadTotal, 2);
  parent.deferred = true;
  parent.deferredTargetDay = 6;
  assert.equal(metrics([parent]).workloadTotal, 0);
});

const renderingDependencies = {
  renderItemDeleteFooter,
  esc: (value: unknown) => String(value ?? ''),
  checked: (value: unknown) => value ? ' checked' : '',
  selected: (left: unknown, right: unknown) => left === right ? ' selected' : '',
  studyItemSubjectClass: () => 'subject-card subject-english',
  itemTitle: (x: StudyItem) => x.title || '英文',
  confirmedDeferred: () => false,
  isCalendarMakeup: () => false,
  isInteractiveDaily: () => false,
  isCalendarNaturalIntegration: () => false,
  isEnglishReview: () => false,
  isGroupedWork: () => false,
  hidesTopMinutes: () => false,
  renderTimeControl: () => '<div class="time-control">time-fixture</div>',
  renderItemFields: () => '<input data-field="fixture">',
  renderDeferredControls: () => '',
  reviewTypeOptions: () => '<option>extra</option>',
  nestedTypeOptions: () => '<option>extra</option>',
  interactiveDailyTypeOptions: () => '<option>extra</option>',
  isFixedMagazine: () => true,
  ensureMagazineEntries: (x: StudyItem) => x.f.entries,
};

test('custom card deletion is last in the card, while preset cards remain undeletable', () => {
  const render = runtimeFunction<(x: StudyItem, deletable: boolean) => string>('renderCard', renderingDependencies);
  const html = render(item({ source: 'custom' }), true);
  assert.ok(html.endsWith(`${renderItemDeleteFooter('delete-item')}</div>`));
  assert.equal(html.split('刪除此筆').length - 1, 1);
  assert.ok(html.indexOf('data-field="fixture"') < html.indexOf('item-footer-actions'));
  assert.doesNotMatch(render(item(), false), /刪除此筆/);
});

test('manually added makeup and review cards put deletion below their fields', () => {
  const render = runtimeFunction<(x: StudyItem, kind: string) => string>('renderNestedEntry', renderingDependencies);
  for (const kind of ['makeup', 'review'] as const) {
    const html = render(item(), kind);
    assert.ok(html.endsWith(`${renderItemDeleteFooter(`${kind}-delete`)}</div>`));
    assert.ok(html.indexOf('data-field="fixture"') < html.indexOf('item-footer-actions'));
  }
});

test('interactive child deletion is bottom-left and locked children still cannot be deleted', () => {
  const render = runtimeFunction<(x: StudyItem) => string>('renderDailyInteractiveEntry', renderingDependencies);
  assert.ok(render(item()).endsWith(`${renderItemDeleteFooter('interactive-delete')}</div>`));
  assert.doesNotMatch(render(item({ locked: true })), /刪除此筆/);
});

test('magazine entries keep their delete index in their own footer and retain the last-entry guard', () => {
  const render = runtimeFunction<(x: StudyItem) => string>('renderMagazineFields', renderingDependencies);
  const html = render(item({ f: { entries: [{ unit: '1' }, { unit: '2' }] } }));
  assert.equal(html.split('刪除此筆').length - 1, 2);
  for (const index of [0, 1]) {
    const footer = renderItemDeleteFooter('mag-delete', index);
    assert.ok(html.includes(`${footer}</div>`));
    assert.ok(html.indexOf(`data-mag-field="unit" data-index="${index}"`) < html.indexOf(footer));
  }
  assert.doesNotMatch(render(item({ f: { entries: [{ unit: '1' }] } })), /刪除此筆/);
});

test('card footer uses left-aligned normal flow rather than overlapping fields', () => {
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.item-footer-actions\{[^}]*display:flex;[^}]*justify-content:flex-start;[^}]*margin-top:10px/);
  assert.doesNotMatch(styles.match(/\.item-footer-actions\{[^}]*\}/)?.[0] || '', /position\s*:\s*(?:absolute|fixed)/);
});
