import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as completion from '../src/study/completionMetrics.ts';
import { isConfirmedDeferred } from '../src/study/deferDays.ts';
import { renderItemDeleteFooter } from '../src/ui/itemActions.ts';
import { propagateDailyWorkField } from '../src/study/dailyWorkGroup.ts';
import { normalizeStudyTimerState } from '../src/study/studyTimer.ts';
import { studyItemSubject } from '../src/study/subjectOrder.ts';
import { summarizeSubjectTime } from '../src/study/subjectTime.ts';
import { completedStudyTimeEntries } from '../src/study/completedStudyTime.ts';
import { isCompletedByDate } from '../src/study/completionCheckedOn.ts';
import { parseCalendarTask } from '../src/calendar/calendarBridge.ts';
import { prioritizeCalendarPageRanges } from '../src/calendar/pagePriority.ts';
import type { StudyItem, StudyRecord } from '../src/types.ts';
import {
  canonicalPageMappedBook,
  CHINESE_TOPIC_BOOK,
  DEEP_FIFTEEN_BOOK,
  ENGLISH_TOPIC_CLOZE_BOOK,
  isEnglishPageMappedBook,
  pageMappedBookUsesScopeSelection,
  pageMappedBookSubject,
} from '../src/data/bookPageMaps.ts';

const runtime = readFileSync(new URL('../src/legacy-app.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

// Execute the actual compatibility-runtime functions without starting auth, storage, or the app.
function runtimeFunction<T>(name: string, dependencies: Record<string, unknown>): T {
  const start = runtime.indexOf(`function ${name}(`);
  const end = runtime.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, `Missing runtime function: ${name}`);
  return runInNewContext(`${runtime.slice(start, end)}\n${name}`, {
    completionDateMarkup: () => '',
    ...dependencies,
  }) as T;
}

function item(overrides: Partial<StudyItem> = {}): StudyItem {
  return { id: 'test-item', type: 'extra', title: '英文', required: true, source: 'preset', done: false, minutes: '', f: {}, ...overrides };
}

const recordUnits = runtimeFunction<(record: StudyRecord, date: string, cutoffDate?: string) => completion.CompletionUnit[]>(
  'completionUnitsForRecord',
  {
    ...completion,
    isCompletedByDate,
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

test('Friday settlement excludes weekday items completed during the weekend', () => {
  const record = { date: '2026-09-16', items: [
    item({ done: true, checkedOn: '2026-09-19' }),
    item({ f: { groupedWorkEntries: [item({ done: true, checkedOn: '2026-09-20' })] } }),
    item({ type: 'interactiveDaily', f: { interactiveEntries: [item({ done: true, checkedOn: '2026-09-18' })] } }),
  ] };
  const friday = completion.summarizeCompletionUnits(recordUnits(record, record.date, '2026-09-18'));
  const sunday = completion.summarizeCompletionUnits(recordUnits(record, record.date, '2026-09-20'));

  assert.equal(friday.itemCompleted, 1);
  assert.equal(friday.workloadCompleted, 1);
  assert.equal(sunday.itemCompleted, 3);
  assert.equal(sunday.workloadCompleted, 3);
});

test('weekly completion metrics pass Friday and Sunday as separate snapshot cutoffs', () => {
  const cutoffs: string[] = [];
  const weekMetrics = runtimeFunction<(date: string, lastDayIndex: number) => completion.CompletionMetrics>(
    'completionMetricsForWeek',
    {
      mondayOf: (date: Date) => date,
      parseDate: (date: string) => new Date(`${date}T12:00:00`),
      dateString: (date: Date) => date.toISOString().slice(0, 10),
      studyRecordForOverview: (date: string) => ({ date, items: [] }),
      completionUnitsForRecord: (_record: StudyRecord, _date: string, cutoffDate: string) => {
        cutoffs.push(cutoffDate);
        return [];
      },
      completionIncludedInPeriod: () => true,
      summarizeCompletionUnits: completion.summarizeCompletionUnits,
    },
  );

  weekMetrics('2026-09-14', 4);
  assert.deepEqual(cutoffs, Array(5).fill('2026-09-18'));
  cutoffs.length = 0;
  weekMetrics('2026-09-14', 6);
  assert.deepEqual(cutoffs, Array(7).fill('2026-09-20'));
});

test('main-page weekly completion skips outside days without hiding their schedule', () => {
  const awayRecord: StudyRecord = {
    date: '2026-09-14', mood: '外出',
    items: [item({ id: 'away-preset', source: 'preset', done: false })],
  };
  const visible = runtimeFunction<(record: StudyRecord) => StudyItem[]>('visibleItems', {
    activeEnglishTaskItems: (_record: StudyRecord, items: StudyItem[]) => items,
  });
  assert.deepEqual(visible(awayRecord).map(entry => entry.id), ['away-preset']);

  const weekMetrics = runtimeFunction<(date: string, lastDayIndex: number) => completion.CompletionMetrics>(
    'completionMetricsForWeek',
    {
      mondayOf: (date: Date) => date,
      parseDate: (date: string) => new Date(`${date}T12:00:00`),
      dateString: (date: Date) => date.toISOString().slice(0, 10),
      studyRecordForOverview: (date: string) => date === awayRecord.date ? awayRecord : { date, items: [] },
      completionIncludedInPeriod: (record: StudyRecord) => record.mood !== '外出' && record.mood !== '身體不適',
      completionUnitsForRecord: () => [completion.originalCompletionUnit(false)],
      summarizeCompletionUnits: completion.summarizeCompletionUnits,
    },
  );
  assert.equal(weekMetrics('2026-09-14', 0).itemTotal, 0);
  assert.doesNotMatch(runtime, /固定排程已全部取消|固定排程全部取消|因外出取消/);
  assert.match(runtime, /原有排程仍保留.*不列入週／月完成率/);
});

test('cloud bootstrap renders the saved day without replacing it with fallback presets', () => {
  const nodes = {
    studyDate: { value: '2026-09-18' },
    weekdayText: { textContent: '' },
    status: { textContent: '' },
  };
  let presetCalls = 0;
  let persistCalls = 0;
  let renderCalls = 0;
  const load = runtimeFunction<(options?: { skipCloudRead?: boolean; cacheOnly?: boolean; skipPresetReconcile?: boolean }) => void>(
    'load',
    {
      id: (name: keyof typeof nodes) => nodes[name],
      loadData: (date: string) => ({ date, items: [{ id: 'saved-calendar-item' }] }),
      cloneRecord: (record: StudyRecord) => structuredClone(record),
      updateCloudConflictUI: () => {},
      updateStorageRecoveryUI: () => {},
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
      parseDate: (date: string) => new Date(`${date}T12:00:00`),
      ensureDailyPresets: () => {
        presetCalls += 1;
        return true;
      },
      ensureEnglishReviewWordEntryIds: () => false,
      writeHeader: () => {},
      render: () => {
        renderCalls += 1;
      },
      persist: () => {
        persistCalls += 1;
        return true;
      },
      cloudUser: {},
      cloudBootstrapPending: true,
      cloudPullDate: () => {},
    },
  );

  load({ skipCloudRead: true, cacheOnly: true, skipPresetReconcile: true });
  assert.equal(renderCalls, 1);
  assert.equal(presetCalls, 0);
  assert.equal(persistCalls, 0);

  load({ skipCloudRead: true });
  assert.equal(renderCalls, 2);
  assert.equal(presetCalls, 1);
  assert.equal(persistCalls, 1);
});

test('cloud activation waits for Calendar data before reconciling visible presets', () => {
  assert.match(runtime, /load\(\{skipCloudRead:true,cacheOnly:true,skipPresetReconcile:true\}\)/);
  assert.match(runtime, /refreshVisibleDataAfterBackgroundSync\(\{skipPresetReconcile:true\}\)/);
  assert.match(runtime, /setCloudVisibleRefreshPending\(true,options\)/);
  assert.match(runtime, /load\(Object\.assign\(\{skipCloudRead:true\},options\|\|\{\}\)\)/);
  assert.match(
    runtime,
    /await withOperationTimeout\(calendarRefreshStatus\(false\)[\s\S]*?if\(serial===cloudActivationSerial\)refreshVisibleDataAfterBackgroundSync\(\)/,
  );
});

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

test('grouped child cards omit title and page-range heading but keep controls and fields', () => {
  const render = runtimeFunction<(entry: StudyItem, index: number) => string>('renderGroupedWorkEntry', {
    studyItemSubjectClass: () => 'subject-math',
    confirmedDeferred: () => false,
    esc: (value: unknown) => String(value ?? ''),
    checked: (value: unknown) => value ? ' checked' : '',
    renderTimeControl: () => '<div class="time-control">time</div>',
    renderItemFields: () => '<div class="field">fields</div>',
    renderDeferredControls: () => '<div class="defer-controls">defer</div>',
  });
  const html = render(item({ id: 'math-child', type: 'mathStudy', title: 'p.149–165', f: { start: '149', end: '165' } }), 0);
  assert.doesNotMatch(html, /item-title|p\.149[–-]165/);
  assert.match(html, /data-done/);
  assert.match(html, /time-control/);
  assert.match(html, /class="inner"/);
  assert.match(html, /defer-controls/);
});

test('Calendar math cards lock the supplied lecture version while manual cards keep the selector', () => {
  const dependencies = {
    isCalendarMathMaterialLocked: (x: StudyItem) => x.f.calendarMathMaterialLocked === true,
    mathMaterialOptions: () => '<option>新關鍵</option>',
    mathBookOptions: () => '<option>1～2</option>',
    esc: (value: unknown) => String(value ?? ''),
    applyMathAuto: () => undefined,
    mathAutoText: () => '單元 1：實數與指對數',
    hasDeferredStudySource: () => false,
    checked: () => '',
    reasonField: () => '',
  };
  const render = runtimeFunction<(entry: StudyItem, reviewMode: boolean) => string>('renderMathFields', dependencies);
  const locked = render(item({ type: 'mathLecture', f: { material: '新關鍵', book: '1~2', start: '2', end: '5', calendarMathMaterialLocked: true } }), false);
  assert.match(locked, /<label>講義版本<\/label><div class="fixed-book-value">新關鍵<\/div>/);
  assert.doesNotMatch(locked, /data-field="material"/);

  const manual = render(item({ type: 'mathLecture', f: { material: '新關鍵', book: '1~2', start: '2', end: '5' } }), false);
  assert.match(manual, /<select data-field="material">/);
});

test('manual added-item selectors only expose the personal tracker materials', () => {
  const selected = (value: unknown, current: unknown) => String(value) === String(current) ? ' selected' : '';
  const esc = (value: unknown) => String(value ?? '');
  const manualOptionGroup = runtimeFunction<(label: string, values: string[], current: string, labelFor?: (value: string) => string) => string>(
    'manualOptionGroup',
    { selected, esc },
  );
  const mathOptions = runtimeFunction<(current: string) => string>('mathMaterialOptions', {
    manualOptionGroup,
  });
  const scienceOptions = runtimeFunction<(subject: string, current: string) => string>('scienceMaterialOptions', {
    manualOptionGroup,
  });
  const readingOptions = runtimeFunction<(current: string) => string>('readingOptions', {
    GSAT_ENGLISH_TITLES: ['ACE Reading', '英文寫作測驗'],
    SUPPLEMENT_ENGLISH_TITLES: ['雜誌', 'Unlock 3 (Listening, Speaking, Critical Thinking)'],
    manualOptionGroup,
  });

  assert.match(mathOptions(''), /optgroup label="複習講義"/);
  assert.match(mathOptions(''), /optgroup label="分冊講義"/);
  assert.match(scienceOptions('化學', ''), /optgroup label="化學"/);
  assert.match(readingOptions(''), /optgroup label="學測"/);
  assert.match(readingOptions(''), /optgroup label="補充"/);
  assert.match(readingOptions(''), /Unlock 3 \(Listening, Speaking, Critical Thinking\)/);
  assert.doesNotMatch(mathOptions(''), /新大滿貫/);
  assert.doesNotMatch(scienceOptions('化學', ''), /領航/);
  assert.doesNotMatch(scienceOptions('物理', ''), /優勢|逆轉勝/);
  assert.doesNotMatch(readingOptions(''), /學測週計畫|混合題30篇實戰演練/);
});

test('date switching saves the current date before loading the requested date', () => {
  const sequence: string[] = [];
  const nodes = {
    studyDate: { value: '2026-09-11' },
    status: { textContent: '' },
  };
  const switchDate = runtimeFunction<(nextDate: string) => boolean>('switchStudyDate', {
    data: { date: '2026-09-10' },
    cloudUser: { id: 'user-1' },
    id: (name: keyof typeof nodes) => nodes[name],
    persist: () => { sequence.push(`save:${nodes.studyDate.value}`); return true; },
    load: () => { sequence.push(`load:${nodes.studyDate.value}`); },
    setSaveButtonState: (state: string) => { sequence.push(`state:${state}`); },
  });

  assert.equal(switchDate('2026-09-11'), true);
  assert.deepEqual(sequence, [
    'state:saving',
    'save:2026-09-10',
    'load:2026-09-11',
    'state:local',
  ]);
  assert.equal(nodes.studyDate.value, '2026-09-11');
  assert.match(nodes.status.textContent, /已存本機 2026-09-10.*切換至 2026-09-11.*背景同步/);
});

test('date switching stays on the current date when saving fails', () => {
  let loadCount = 0;
  const nodes = {
    studyDate: { value: '2026-09-11' },
    status: { textContent: '' },
  };
  const states: string[] = [];
  const switchDate = runtimeFunction<(nextDate: string) => boolean>('switchStudyDate', {
    data: { date: '2026-09-10' },
    cloudUser: null,
    id: (name: keyof typeof nodes) => nodes[name],
    persist: () => false,
    load: () => { loadCount += 1; },
    setSaveButtonState: (state: string) => { states.push(state); },
  });

  assert.equal(switchDate('2026-09-11'), false);
  assert.equal(nodes.studyDate.value, '2026-09-10');
  assert.equal(loadCount, 0);
  assert.deepEqual(states, ['saving', 'error']);
  assert.match(nodes.status.textContent, /已取消日期切換/);
});

test('Calendar New Key material and grouped book replace stale defaults unless the user edited them', () => {
  const parsed = parseCalendarTask({
    event_key: 'primary:new-key-34',
    source_event_id: 'new-key-34',
    calendar_id: 'primary',
    event_date: '2026-09-14',
    title: '數學講義：進度',
    description: '【講義版本】新關鍵\n【冊別】3A-4A冊\n【頁碼範圍】31–57\n【識別碼】new-key-34',
    category: 'studyItem',
  });
  assert.equal(parsed.kind, 'math');
  if (parsed.kind !== 'math') throw new Error('Expected math Calendar item');
  const resolveCloudMathPlan = runtimeFunction<(task: typeof parsed) => any>('resolveCloudMathPlan', {
    CALENDAR_MATH_PLAN: {},
    cloneObj: (value: unknown) => JSON.parse(JSON.stringify(value)),
    prioritizeCalendarPageRanges,
  });
  const plan = resolveCloudMathPlan(parsed);
  assert.equal(plan.calendarMaterialSource, 'calendar');
  const applyCalendarMathPlan = runtimeFunction<(record: StudyRecord, date: string) => boolean>('applyCalendarMathPlan', {
    activeCalendarMathPlan: () => plan,
    CALENDAR_MATH_UNIT_TARGET_OVERRIDES: {},
    calendarWeekMathTarget: () => 0,
    applyMathAuto: () => {},
  });
  const automatic = item({
    id: 'math-auto', type: 'mathStudy', source: 'preset',
    f: { material: '教學講義', book: '3A', start: '1', end: '10' },
  });
  assert.equal(applyCalendarMathPlan({ date: '2026-09-14', items: [automatic] }, '2026-09-14'), true);
  assert.deepEqual(
    [automatic.f.material, automatic.f.book, automatic.f.start, automatic.f.end],
    ['新關鍵', '3A~4A', '31', '57'],
  );

  const manual = item({
    id: 'math-manual', type: 'mathStudy', source: 'preset',
    f: {
      material: '智慧型', book: '3A~4A', start: '5', end: '8',
      dailyWorkUserFields: { material: true, book: true, start: true, end: true },
    },
  });
  applyCalendarMathPlan({ date: '2026-09-14', items: [manual] }, '2026-09-14');
  assert.deepEqual(
    [manual.f.material, manual.f.book, manual.f.start, manual.f.end],
    ['智慧型', '3A~4A', '5', '8'],
  );
});

test('ten-minute cloud save uploads the current record without interrupting its timer', async () => {
  const timeTracking = { mode: 'timer', accumulatedSeconds: 42, startedAt: 1_788_000_000_000 };
  const currentRecord = { date: '2026-09-10', localDirty: true, syncConflict: false, items: [{ f: { timeTracking } }] };
  const calls: string[] = [];
  const savePeriodically = runtimeFunction<() => Promise<boolean>>('periodicCloudSave', {
    periodicCloudSaveBusy: false,
    data: currentRecord,
    cloudUser: { id: 'user-1' },
    cloudClient: {},
    cloudLoading: false,
    cloudBootstrapPending: false,
    currentStorageIsUserScoped: () => true,
    persist: () => { calls.push('persist'); return true; },
    readStoredRecord: () => currentRecord,
    queueCloudSave: () => { calls.push('queue'); },
    cloudSaveQueue: { flush: async (date: string) => { calls.push(`flush:${date}`); currentRecord.localDirty = false; } },
  });

  assert.equal(await savePeriodically(), true);
  assert.deepEqual(calls, ['persist', 'queue', 'flush:2026-09-10']);
  assert.deepEqual(timeTracking, { mode: 'timer', accumulatedSeconds: 42, startedAt: 1_788_000_000_000 });
});

test('periodic cloud save interval is exactly ten minutes', () => {
  assert.match(runtime, /PERIODIC_CLOUD_SAVE_MS\s*=\s*10\s*\*\s*60\s*\*\s*1000/);
  assert.match(runtime, /setInterval\(periodicCloudSave,PERIODIC_CLOUD_SAVE_MS\)/);
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

test('interactive and nested completion dates render below their title controls', () => {
  const dateMarkup = () => '<label class="completion-date-editor">完成日期</label>';
  const interactive = runtimeFunction<(x: StudyItem) => string>('renderDailyInteractiveEntry', {
    ...renderingDependencies,
    completionDateMarkup: dateMarkup,
  });
  const interactiveHtml = interactive(item({ done: true }));
  assert.ok(interactiveHtml.indexOf('data-interactive-type') < interactiveHtml.indexOf('completion-date-editor'));
  const lockedInteractiveHtml = interactive(item({ done: true, locked: true, description: '標題備註' }));
  assert.ok(lockedInteractiveHtml.indexOf('標題備註') < lockedInteractiveHtml.indexOf('completion-date-editor'));

  const card = runtimeFunction<(x: StudyItem, deletable: boolean) => string>('renderCard', {
    ...renderingDependencies,
    completionDateMarkup: dateMarkup,
  });
  const cardHtml = card(item({ done: true, description: '標題備註' }), false);
  assert.ok(cardHtml.indexOf('標題備註') < cardHtml.indexOf('completion-date-editor'));

  const nested = runtimeFunction<(x: StudyItem, kind: string) => string>('renderNestedEntry', {
    ...renderingDependencies,
    completionDateMarkup: dateMarkup,
  });
  const nestedHtml = nested(item({ done: true }), 'makeup');
  assert.ok(nestedHtml.indexOf('data-nested-type') < nestedHtml.indexOf('completion-date-editor'));
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

test('natural integration children expose their own manual and timer control', () => {
  const render = runtimeFunction<(entry: Record<string, unknown>) => string>('renderCalendarNaturalIntegrationEntry', {
    esc: (value: unknown) => String(value ?? ''),
    checked: (value: unknown) => value ? ' checked' : '',
    renderTimeControl: (entry: Record<string, unknown>) => `<span data-child-time="${entry.id}"></span>`,
  });
  const html = render({
    id: 'natural-integration-2026-09-13-生物',
    subject: '生物',
    done: true,
    minutes: '18',
    ranges: [[16, 18]],
    pageText: 'p.16–18',
    chapterText: '細胞呼吸',
  });

  assert.match(html, /data-child-time="natural-integration-2026-09-13-生物"/);
  assert.match(html, /data-item="natural-integration-2026-09-13-生物"/);
});

test('every completed time-capable child counts without waiting for its parent card', () => {
  const completed = (id: string, subject: string, minutes: string) => item({
    id, type: subject === '英文' ? 'extra' : 'scienceReview', done: true, minutes, f: { subject },
  });
  const pending = (id: string, subject: string, minutes: string) => item({
    id, type: 'scienceReview', done: false, minutes, f: { subject },
  });
  const items = [
    item({ id: 'group', f: { groupedWorkEntries: [completed('group-done', '生物', '12'), pending('group-pending', '化學', '90')] } }),
    item({ id: 'interactive', type: 'interactiveDaily', f: { interactiveEntries: [completed('interactive-done', '英文', '7'), pending('interactive-pending', '英文', '80')] } }),
    item({ id: 'natural', type: 'scienceReview', minutes: '99', f: {
      calendarNaturalIntegration: true,
      calendarIntegrationEntries: [
        { id: 'natural-done', subject: '化學', done: true, minutes: '8', f: { subject: '化學' } },
        { id: 'natural-pending', subject: '物理', done: false, minutes: '70', f: { subject: '物理' } },
      ],
    } }),
    item({ id: 'makeup', type: 'general', presetKey: 'sat_makeup', f: { makeupEntries: [completed('makeup-done', '國文', '5')] } }),
  ];
  const nodes = new Proxy<Record<string, { textContent: string; style: { width?: string } }>>({}, {
    get(target, key: string) {
      return target[key] ||= { textContent: '', style: {} };
    },
  });
  let renderedTotal = -1;
  const update = runtimeFunction<() => void>('updateSummary', {
    data: { date: '2026-09-13', items },
    studyRecordsForOverview: () => [{ date: '2026-09-13', items }],
    cloneRecord: (record: StudyRecord) => structuredClone(record),
    completedTimeEntriesForOverviewDate: () => completedStudyTimeEntries([{ date: '2026-09-13', items }]),
    mathProgressIndex: { upsert() {}, view: () => [] },
    visibleItems: (record: { items: StudyItem[] }) => record.items,
    isGroupedWork: (x: StudyItem) => Boolean(x.f.groupedWorkEntries?.length),
    groupedWorkEntries: (x: StudyItem) => x.f.groupedWorkEntries || [],
    isInteractiveDaily: (x: StudyItem) => x.type === 'interactiveDaily',
    ensureInteractiveEntries: (x: StudyItem) => x.f.interactiveEntries || [],
    isCalendarNaturalIntegration: (x: StudyItem) => x.f.calendarNaturalIntegration === true,
    ensureCalendarNaturalIntegrationEntries: (x: StudyItem) => x.f.calendarIntegrationEntries || [],
    isSaturdayMakeup: (x: StudyItem) => x.presetKey === 'sat_makeup',
    ensureEntryArray: (x: StudyItem) => x.f.makeupEntries || [],
    isFixedMagazine: () => false,
    fixedMagazineMinutes: () => 0,
    isEnglishReview: () => false,
    studyItemSubject,
    summarizeSubjectTime,
    completionUnitsForRecord: () => [],
    summarizeCompletionUnits: () => ({ itemPercent: 0, itemCompleted: 0, itemTotal: 0, workloadPercent: 0, workloadCompleted: 0, workloadTotal: 0 }),
    calculateMathProgress: () => ({ dailyNewPages: 0, weeklyNewPages: 0, weeklyTarget: 0, weeklyPercent: 0 }),
    calendarWeekMathTarget: () => 0,
    id: (name: string) => nodes[name],
    updateSettlementMetrics() {},
    renderCompletionTrend() {},
    updateCompletionView() {},
    renderSubjectTimeDonut: (summary: { totalMinutes: number }) => { renderedTotal = summary.totalMinutes; },
  });

  update();
  assert.equal(renderedTotal, 32);
});

test('mixed writing places both quarter-width scores beside one spanning priority field', () => {
  const render = runtimeFunction<(x: StudyItem, reviewMode: boolean) => string>('renderItemFields', {
    isGroupedWork: () => false,
    esc: (value: unknown) => String(value ?? ''),
  });
  const html = render(item({
    type: 'englishMixedWriting',
    f: { essayScore: '12', mixedScore: '8', priorityFix: '時態與轉折詞' },
  }), false);

  assert.match(html, /class="english-mixed-writing-layout"/);
  assert.match(html, /class="field compact-number emw-essay">.*data-field="essayScore"/);
  assert.match(html, /class="field compact-number emw-mixed">.*data-field="mixedScore"/);
  assert.match(html, /class="field emw-priority">.*<textarea rows="5" data-field="priorityFix">時態與轉折詞<\/textarea>/);
  assert.match(styles, /\.english-mixed-writing-layout \.emw-essay\{grid-column:1;grid-row:1\}/);
  assert.match(styles, /\.english-mixed-writing-layout \.emw-mixed\{grid-column:1;grid-row:2\}/);
  assert.match(styles, /\.english-mixed-writing-layout \.emw-priority\{grid-column:2\/span 3;grid-row:1\/span 2/);
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
    pageMappedBookUsesScopeSelection,
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
    pageMappedBookUsesScopeSelection,
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

test('manual completion stores late dates and mirrors deferred completion to its origin', () => {
  assert.match(runtime, /applyManualCompletionMetadata\(x,t\.checked,data\.date,completionActionDate,data\.items\)/);
  assert.match(runtime, /syncDeferredCompletionToOrigins\(deferredCompletionRequests,t\.checked,completionActionDate\)/);
  assert.match(runtime, /propagateDailyWorkCompletionDates\(originTarget,checked\?actionDate:undefined,checked\?actionDate:undefined\)/);
  assert.match(runtime, /completedSnapshot=existing\[matchIndex\].*deferredCompletionDate\(existing\[matchIndex\]\)>=date/);
  assert.match(styles, /\.completion-date-editor\{/);
});
