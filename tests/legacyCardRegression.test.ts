import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as completion from '../src/study/completionMetrics.ts';
import { isConfirmedDeferred } from '../src/study/deferDays.ts';
import { renderItemDeleteFooter } from '../src/ui/itemActions.ts';
import { propagateDailyWorkField } from '../src/study/dailyWorkGroup.ts';
import { normalizeStudyTimerState } from '../src/study/studyTimer.ts';
import type { StudyItem, StudyRecord } from '../src/types.ts';
import {
  canonicalPageMappedBook,
  CHINESE_TOPIC_BOOK,
  DEEP_FIFTEEN_BOOK,
  ENGLISH_TOPIC_CLOZE_BOOK,
  isEnglishPageMappedBook,
  pageMappedBookSubject,
} from '../src/data/bookPageMaps.ts';

const runtime = readFileSync(new URL('../src/legacy-app.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

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

test('the recorded minute field accepts one-decimal timer values', () => {
  const render = runtimeFunction<(x: StudyItem, entry?: null) => string>('renderTimeControl', {
    normalizeStudyTimerState,
    esc: (value: unknown) => String(value ?? ''),
  });
  const html = render(item({ minutes: '1.5' }), null);

  assert.match(html, /step="0\.1"/);
  assert.match(html, /inputmode="decimal"/);
  assert.match(html, /value="1\.5"/);
});

test('Chinese page-mapped books are selected directly from 國文項目 without another book selector', () => {
  const render = runtimeFunction<(x: StudyItem, reviewMode: boolean) => string>('renderChineseFields', {
    isCalendarGujin: () => false,
    isCalendarPageMappedBook: () => false,
    canonicalPageMappedBook,
    CHINESE_TOPIC_BOOK,
    DEEP_FIFTEEN_BOOK,
    esc: (value: unknown) => String(value ?? ''),
    selected: (left: unknown, right: unknown) => left === right ? ' selected' : '',
    checked: (value: unknown) => value ? ' checked' : '',
    bookPageAutoField: () => '<div data-book-page-auto>fixture</div>',
  });
  const html = render(item({
    type: 'chineseReading',
    title: '國文',
    f: { kind: 'book', book: DEEP_FIFTEEN_BOOK, start: '8', end: '25' },
  }), false);

  assert.match(html, /<label>國文項目<\/label><select data-chinese-kind>/);
  assert.match(html, /class="chinese-book-main-row"/);
  assert.match(html, /value="深耕十五" selected>深耕十五<\/option>/);
  assert.match(html, /value="主題百匯：閱讀寫作新進化">主題百匯：閱讀寫作新進化<\/option>/);
  assert.doesNotMatch(html, /<label>書名<\/label>/);
  assert.equal((html.match(/data-field="start"/g) || []).length, 1);
  assert.equal((html.match(/data-field="end"/g) || []).length, 1);
  assert.ok(html.indexOf('data-chinese-kind') < html.indexOf('data-field="start"'));
  assert.ok(html.indexOf('data-field="start"') < html.indexOf('data-field="end"'));
});

test('manual Chinese item fields use the requested half and quarter widths', () => {
  const render = runtimeFunction<(x: StudyItem, reviewMode: boolean) => string>('renderChineseFields', {
    isCalendarGujin: () => false,
    isCalendarPageMappedBook: () => false,
    canonicalPageMappedBook,
    DEEP_FIFTEEN_BOOK,
    CHINESE_TOPIC_BOOK,
    selected: (left: unknown, right: unknown) => left === right ? ' selected' : '',
    checked: (value: unknown) => value ? ' checked' : '',
    reasonField: () => '',
    esc: (value: unknown) => String(value ?? ''),
  });
  const html = render(item({
    type: 'chineseReading',
    source: 'custom',
    f: { kind: 'reading', round: '10' },
  }), false);

  assert.match(html, /class="chinese-book-main-row chinese-reading-row"/);
  assert.match(html, /<label>國文項目<\/label><select data-chinese-kind>/);
  assert.match(html, /<label>回數<\/label>.*data-field="round" value="10"/);
  assert.ok(html.indexOf('data-chinese-kind') < html.indexOf('data-field="round"'));
  assert.match(styles, /\.chinese-book-main-row\{grid-template-columns:minmax\(0,2fr\) minmax\(0,1fr\) minmax\(0,1fr\)\}/);

  const emptyHtml = render(item({
    type: 'chineseReading',
    source: 'custom',
    f: { kind: '' },
  }), false);
  assert.match(emptyHtml, /class="chinese-book-main-row"/);
  assert.equal((emptyHtml.match(/class="field chinese-book-item"/g) || []).length, 1);
});

test('manual Chinese writing uses the three-row half-quarter layout', () => {
  const render = runtimeFunction<(x: StudyItem, reviewMode: boolean) => string>('renderChineseFields', {
    isCalendarGujin: () => false,
    isCalendarPageMappedBook: () => false,
    canonicalPageMappedBook,
    DEEP_FIFTEEN_BOOK,
    CHINESE_TOPIC_BOOK,
    selected: (left: unknown, right: unknown) => left === right ? ' selected' : '',
    checked: (value: unknown) => value ? ' checked' : '',
    reasonField: () => '',
    esc: (value: unknown) => String(value ?? ''),
  });
  const html = render(item({
    type: 'chineseReading',
    source: 'custom',
    f: { kind: 'writing', topic: '測試題目', score: '20', writingType: '知性題', improvement: '加強結構' },
  }), false);

  assert.match(html, /class="chinese-writing-layout"/);
  assert.match(html, /class="cw-item">.*data-chinese-kind/);
  assert.match(html, /class="field cw-topic">.*data-field="topic"/);
  assert.match(html, /class="field compact-number cw-score">.*data-field="score"/);
  assert.match(html, /class="field cw-type">.*data-field="writingType"/);
  assert.match(html, /class="field cw-improvement">.*data-field="improvement"/);
  assert.match(styles, /\.chinese-writing-layout \.cw-item\{grid-column:1\/span 2;grid-row:1\}/);
  assert.match(styles, /\.chinese-writing-layout \.cw-improvement\{grid-column:2\/span 3;grid-row:2\/span 2/);
});

test('Chinese book page mapping is split into topic and chapter half rows', () => {
  const render = runtimeFunction<(book: string, start: unknown, end: unknown) => string>('bookPageAutoField', {
    bookPageTopicText: (book: string) => book === DEEP_FIFTEEN_BOOK ? '先秦文學主流與發展' : '自我覺察與生命教育',
    bookPageDetailText: (book: string) => book === DEEP_FIFTEEN_BOOK ? '燭之武退秦師' : '新手級',
    esc: (value: unknown) => String(value ?? ''),
  });
  const deepHtml = render(DEEP_FIFTEEN_BOOK, 8, 25);
  assert.match(deepHtml, /class="chinese-book-map-row"/);
  assert.match(deepHtml, /<label>對應主題<\/label>.*先秦文學主流與發展/);
  assert.match(deepHtml, /<label>對應章節<\/label>.*燭之武退秦師/);

  const topicHtml = render(CHINESE_TOPIC_BOOK, 2, 6);
  assert.match(topicHtml, /<label>對應主題<\/label>.*自我覺察與生命教育/);
  assert.match(topicHtml, /<label>對應章節<\/label>.*新手級/);
});

test('English Topic Collection books use ACE-style topic and round fields without page inputs', () => {
  const render = runtimeFunction<(x: StudyItem, reviewMode: boolean) => string>('renderExtraFields', {
    isPrism: () => false,
    isAce: () => false,
    isEnglishPageMappedBook,
    canonicalPageMappedBook,
    isCalendarPageMappedBook: () => false,
    readingOptions: () => `<option selected>${ENGLISH_TOPIC_CLOZE_BOOK}</option>`,
    reviewEnglishOptions: () => '',
    englishPageBookTopicOptions: () => '<option selected>新新世代</option>',
    englishPageBookRoundOptions: () => '<option selected>第二回</option>',
    checked: (value: unknown) => value ? ' checked' : '',
    reasonField: () => '<textarea data-field="reason"></textarea>',
    esc: (value: unknown) => String(value ?? ''),
  });
  const html = render(item({ f: { title: ENGLISH_TOPIC_CLOZE_BOOK, book: ENGLISH_TOPIC_CLOZE_BOOK, topic: '新新世代', round: '第二回' } }), false);

  assert.match(html, /<label>主題<\/label><select data-book-topic>/);
  assert.match(html, /<label>回次<\/label><select data-book-round>/);
  assert.match(html, /data-check="progress"/);
  assert.match(html, /data-check="graded"/);
  assert.match(html, /data-check="corrected"/);
  assert.doesNotMatch(html, /data-field="start"|data-field="end"|起始頁|結束頁/);

  const emptyTopicHtml = render(item({ f: { title: ENGLISH_TOPIC_CLOZE_BOOK, book: ENGLISH_TOPIC_CLOZE_BOOK, topic: '', round: '' } }), false);
  assert.match(emptyTopicHtml, /<label>回次<\/label><select data-book-round>/);
  assert.doesNotMatch(emptyTopicHtml, /data-book-round disabled/);
});

test('Calendar book scopes render as fixed fields for all four supported books', () => {
  const renderEnglish = runtimeFunction<(x: StudyItem, reviewMode: boolean) => string>('renderExtraFields', {
    isPrism: () => false,
    isAce: () => false,
    isEnglishPageMappedBook,
    canonicalPageMappedBook,
    isCalendarPageMappedBook: (x: StudyItem) => x.f.calendarBookRangeLocked === true,
    readingOptions: () => '',
    reviewEnglishOptions: () => '',
    checked: () => '',
    reasonField: () => '',
    esc: (value: unknown) => String(value ?? ''),
  });
  const englishHtml = renderEnglish(item({
    source: 'preset', presetKey: 'cal_book_scope',
    f: { title: ENGLISH_TOPIC_CLOZE_BOOK, book: ENGLISH_TOPIC_CLOZE_BOOK, topic: '新新世代', round: '第二回', calendarBookRangeLocked: true },
  }), false);
  assert.match(englishHtml, /新新世代/);
  assert.match(englishHtml, /第二回/);
  assert.doesNotMatch(englishHtml, /<select|data-field="start"|data-field="end"/);

  const renderChinese = runtimeFunction<(x: StudyItem, reviewMode: boolean) => string>('renderChineseFields', {
    isCalendarGujin: () => false,
    isCalendarPageMappedBook: (x: StudyItem) => x.f.calendarBookRangeLocked === true,
    canonicalPageMappedBook,
    bookPageAutoField: () => '<div class="chinese-book-map-row"><label>對應主題</label><label>對應章節</label></div>',
    reasonField: () => '',
    esc: (value: unknown) => String(value ?? ''),
  });
  const chineseHtml = renderChinese(item({
    type: 'chineseReading', source: 'preset', presetKey: 'cal_book_pages',
    f: { kind: 'book', book: DEEP_FIFTEEN_BOOK, start: '8', end: '25', calendarBookRangeLocked: true },
  }), false);
  assert.match(chineseHtml, /<label>國文項目<\/label>/);
  assert.match(chineseHtml, /class="chinese-book-main-row"/);
  assert.match(chineseHtml, /<label>起始頁<\/label><div class="fixed-book-value">8<\/div>/);
  assert.match(chineseHtml, /<label>結束頁<\/label><div class="fixed-book-value">25<\/div>/);
  assert.match(chineseHtml, /<label>對應主題<\/label><label>對應章節<\/label>/);
  assert.doesNotMatch(chineseHtml, /<select|data-field="start"|data-field="end"/);
});

test('manual English topic selection keeps a compatible round and never creates page fields', () => {
  const applySelection = runtimeFunction<(x: StudyItem, field: string, value: string) => boolean>('applyEnglishPageBookSelection', {
    canonicalPageMappedBook,
    bookDetailsForTopic: (_book: unknown, topic: unknown) => topic === '人生哲理'
      ? ['第一回', '第二回', '第三回', '第四回']
      : ['第一回', '第二回', '第三回', '第四回'],
    pageMappedBookSubject,
    isCalendarPageMappedBook: (x: StudyItem) => x.f.calendarBookRangeLocked === true,
    propagateDailyWorkField,
  });
  const candidate = item({ f: { title: ENGLISH_TOPIC_CLOZE_BOOK, book: ENGLISH_TOPIC_CLOZE_BOOK, topic: '新新世代', round: '第一回' } });
  assert.equal(applySelection(candidate, 'topic', '人生哲理'), true);
  assert.deepEqual([candidate.f.topic, candidate.f.round], ['人生哲理', '第一回']);
  assert.equal(candidate.f.start, undefined);
  assert.equal(candidate.f.end, undefined);
  assert.equal(applySelection(candidate, 'round', '第三回'), true);
  assert.equal(candidate.f.round, '第三回');
  candidate.f.calendarBookRangeLocked = true;
  assert.equal(applySelection(candidate, 'round', '第四回'), false);
  assert.equal(candidate.f.round, '第三回');
});

test('card footer uses left-aligned normal flow rather than overlapping fields', () => {
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.item-footer-actions\{[^}]*display:flex;[^}]*justify-content:flex-start;[^}]*margin-top:10px/);
  assert.doesNotMatch(styles.match(/\.item-footer-actions\{[^}]*\}/)?.[0] || '', /position\s*:\s*(?:absolute|fixed)/);
});
