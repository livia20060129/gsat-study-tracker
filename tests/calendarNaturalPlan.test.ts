import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import { parseCalendarTask, calendarFixedTemplate } from '../src/calendar/calendarBridge.ts';
import type { CalendarTaskRow } from '../src/calendar/calendarBridge.ts';
import { combineNaturalCalendarPlans, resolveNaturalCalendarPlan } from '../src/calendar/naturalPlan.ts';
import { buildCalendarStudyTaskPlan } from '../src/application/calendar/calendarStudyTaskService.ts';
import { dedupePresetDefinitions, presetDefinitionSemanticKey } from '../src/study/presetDedup.ts';
import { applyDailyWorkRangeOverrides, groupDailyWorkItems, ungroupDailyWorkItems } from '../src/study/dailyWorkGroup.ts';
import { cloneOriginalItemForMakeup, effectiveTemplatePresetKey, mergeMakeupProgress } from '../src/study/makeup.ts';
import { reconcileCalendarNaturalPriorCoverage } from '../src/study/calendarNaturalCompletion.ts';

const date = '2026-09-02';
function row(id: string, title: string, description: string): CalendarTaskRow {
  return { event_key: `primary:${id}`, source_event_id: id, calendar_id: 'primary', event_date: date, title, description, category: 'natural' };
}
// Descriptions reproduced from the two Google Calendar events read on 2026-09-04.
const biology = row('biology', '生物｜光合作用', '`【講義版本】123日的淬鍊 【頁碼範圍】p.16–18 【重點】光合作用 【識別碼】GSAT-SPLIT-NATURAL-2026-09-02`\n\n');
const chemistry = row('chemistry', '化學｜原子結構、同位素與週期表', '`【講義版本】123日的淬鍊 【頁碼範圍】p.45–62 【來源日期】2026/8/24 【重點】原子結構、同位素與週期表 【識別碼】GSAT-SPLIT-\nNATURAL-2026-08-24`\n\n');
const runtime = readFileSync(new URL('../src/legacy-app.ts', import.meta.url), 'utf8');
const clone = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));

// Exercise the real runtime orchestration without network, DOM, or user storage.
function app(rows = [biology, chemistry]) {
  const ctx = createContext({
    buildCalendarStudyTaskPlan, resolveNaturalCalendarPlan, combineNaturalCalendarPlans,
    calendarFixedTemplate, dedupePresetDefinitions, presetDefinitionSemanticKey,
    groupDailyWorkItems, ungroupDailyWorkItems, applyDailyWorkRangeOverrides,
    effectiveTemplatePresetKey, reconcileCalendarNaturalPriorCoverage,
    cloneObj: clone, cloneValue: clone,
    calendarConnected: true, calendarCacheLoaded: true, DAILY_PRESET_START: '2026-08-17',
    CALENDAR_NATURAL_RECOMMENDED_PAGES: {
      [date]: { subject: '生物', material: '123日的淬鍊', label: '光合作用', basis: 'unit fallback', ranges: [[16, 20]] },
    },
    normalizeItem: () => {}, ensureInteractiveEntries: () => [],
    applyCalendarMathPlan: () => false, ensureDeferredForDate: () => false,
    completedNaturalIntervalsBefore: (_date: string, subject: string) => subject === '化學' ? [[45, 62]] : [],
  });
  for (const name of ['naturalRecommendationByTopic', 'buildCalendarRuntime', 'calendarNaturalRecommended',
    'calendarNaturalRanges', 'calendarNaturalPriorCoverage', 'applyCalendarNaturalRecommended',
    'calendarEventToken', 'calendarIdentifierToken', 'cloudCalendarDefsForDate', 'presetDef', 'makePresetItem',
    'calendarEventKeysFromFields', 'itemTitle', 'isCalendarNatural', 'isCalendarNaturalIntegration',
    'groupedWorkEntries', 'isGroupedWork', 'deferredCarryOriginIds', 'groupedEntryMatch',
    'mergeGroupedEntry', 'reconcileGroupedWorkEntries', 'ensureDailyPresets']) {
    const start = runtime.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    const rest = runtime.slice(start + 1);
    const end = rest.search(/\n(?:async )?function /);
    runInContext(runtime.slice(start, start + 1 + end), ctx);
  }
  ctx.presetsForDate = (day: string) => dedupePresetDefinitions(ctx.cloudCalendarDefsForDate(day));
  ctx.buildCalendarRuntime(rows);
  return ctx;
}

test('the real September 2 note parses biology as 16–18, despite its outer backticks', () => {
  const parsed = parseCalendarTask(biology);
  assert.equal(parsed.kind, 'natural');
  if (parsed.kind !== 'natural') throw new Error('Expected natural');
  assert.deepEqual([parsed.startPage, parsed.endPage], [16, 18]);
  assert.equal(resolveNaturalCalendarPlan(parsed)?.material, '123日的淬鍊');
});

test('runtime cards keep biology and chemistry pages independent in either fetch order', () => {
  for (const rows of [[biology, chemistry], [chemistry, biology]]) {
    const ctx = app(rows);
    const defs = ctx.cloudCalendarDefsForDate(date);
    const bio = defs.find((def: any) => def.f.subject === '生物');
    const chem = defs.find((def: any) => def.f.subject === '化學');
    assert.deepEqual([bio.f.start, bio.f.end], ['16', '18']);
    assert.deepEqual([chem.f.start, chem.f.end], ['45', '62']);
    assert.equal(bio.required, true);
    assert.equal(chem.required, false);
    assert.match(bio.description, /p\.16–18/);
    assert.doesNotMatch(bio.description, /45–62/);
  }
});

test('existing wrong pages repair on reconciliation/reload without losing time or explicit completion', () => {
  const ctx = app();
  let rec = { date, items: ctx.cloudCalendarDefsForDate(date).map((def: any) => ctx.makePresetItem(def, date)) };
  const bio = rec.items.find((item: any) => item.f.subject === '生物');
  bio.f.start = '45'; bio.f.end = '62'; bio.minutes = '27';
  bio.done = true; bio.f.calendarCompletionSetByUser = true;
  ctx.ensureDailyPresets(rec, date);
  rec = clone(rec);
  ctx.ensureDailyPresets(rec, date);
  const fixed = ungroupDailyWorkItems(rec.items).find(item => item.f.subject === '生物')!;
  assert.deepEqual([fixed.f.start, fixed.f.end], ['16', '18']);
  assert.equal(fixed.minutes, '27');
  assert.equal(fixed.done, true);
});

test('all natural cards get their own coverage; chemistry completion does not mark biology done', () => {
  const ctx = app();
  const rec = { date, items: ctx.cloudCalendarDefsForDate(date).map((def: any) => ctx.makePresetItem(def, date)) };
  ctx.applyCalendarNaturalRecommended(rec, date);
  const bio = rec.items.find((item: any) => item.f.subject === '生物');
  const chem = rec.items.find((item: any) => item.f.subject === '化學');
  assert.equal(bio.done, false);
  assert.equal(bio.f.calendarSuggestedTotalPages, 3);
  assert.equal(bio.f.calendarSuggestedDonePages, 0);
  assert.equal(chem.done, true);
  assert.equal(chem.f.calendarSuggestedTotalPages, 18);
  assert.equal(chem.f.calendarSuggestedDonePages, 18);
});

test('separate ranges of the same subject survive grouped-card creation and reload', () => {
  const extra = row('biology-2', '生物｜另一單元', '【講義版本】123日的淬鍊【頁碼範圍】30–32');
  const ctx = app([biology, extra, chemistry]);
  const rec = { date, items: [] };
  ctx.ensureDailyPresets(rec, date);
  ctx.ensureDailyPresets(rec, date);
  const leaves = ungroupDailyWorkItems(rec.items).flatMap(item => item.f.groupedWorkEntries || [item]).filter(item => item.f.subject === '生物');
  assert.deepEqual(leaves.map(item => [item.f.start, item.f.end]).sort(), [['16', '18'], ['30', '32']]);
  assert.ok(leaves.every(item => item.f.calendarSuggestedTotalPages === 3));
});

test('manual range edits remain authoritative after repairing the Calendar defaults', () => {
  const ctx = app();
  const rec = { date, items: ctx.cloudCalendarDefsForDate(date).map((def: any) => ctx.makePresetItem(def, date)) };
  const bio = rec.items.find((item: any) => item.f.subject === '生物');
  bio.f.dailyWorkUserFields = { start: '17', end: '19' };
  ctx.ensureDailyPresets(rec, date);
  const fixed = ungroupDailyWorkItems(rec.items).find(item => item.f.subject === '生物')!;
  assert.deepEqual([fixed.f.start, fixed.f.end], ['17', '19']);
});

test('another subject/material cannot supply fallback pages for an event', () => {
  const task = parseCalendarTask(row('missing', '生物｜光合作用', '【講義版本】好考點'));
  if (task.kind !== 'natural') throw new Error('Expected natural');
  const fallback = { subject: '生物', material: '123日的淬鍊', label: '光合作用', basis: '', ranges: [[16, 20]] as [number, number][] };
  assert.equal(resolveNaturalCalendarPlan(task, fallback), null);
  assert.deepEqual(resolveNaturalCalendarPlan({ ...task, material: '123日的淬鍊' }, fallback)?.ranges, [[16, 20]]);
  assert.equal(resolveNaturalCalendarPlan(task, { ...fallback, subject: '化學', material: '好考點' }), null);
});

test('adjacent merged events keep a union; unrelated events are not combined', () => {
  const first = { subject: '生物', material: '123日的淬鍊', label: 'A', basis: '', ranges: [[16, 18]] as [number, number][] };
  const second = { ...first, label: 'B', ranges: [[19, 21]] as [number, number][] };
  assert.deepEqual(combineNaturalCalendarPlans([first, second, first])?.ranges, [[16, 21]]);
  assert.equal(combineNaturalCalendarPlans([first, { ...second, subject: '化學' }]), null);
});

test('deferral and repeated deferral refresh inherited wrong pages and retain makeup user data', () => {
  const ctx = app();
  const original = ctx.makePresetItem(ctx.cloudCalendarDefsForDate(date)[0], date);
  const carried = cloneOriginalItemForMakeup(original, { id: 'carry', presetKey: 'deferred_bio', originDate: date });
  const existing = clone(carried);
  existing.f.start = '45'; existing.f.end = '62'; existing.minutes = '15'; existing.f.reason = '保留筆記';
  const repaired = mergeMakeupProgress(carried, existing);
  assert.deepEqual([repaired.f.start, repaired.f.end], ['16', '18']);
  assert.equal(repaired.minutes, '15');
  assert.equal(repaired.f.reason, '保留筆記');
  const second = cloneOriginalItemForMakeup(repaired, { id: 'carry-again', presetKey: 'deferred_again', originDate: '2026-09-03' });
  assert.deepEqual([second.f.start, second.f.end], ['16', '18']);
  existing.f.dailyWorkUserFields = { end: '19' };
  assert.equal(mergeMakeupProgress(carried, existing).f.end, '19');
});

test('each child of a deferred natural group keeps its own pages and manual edits', () => {
  const ctx = app();
  const bio = ctx.makePresetItem(ctx.cloudCalendarDefsForDate(date)[0], date);
  const second = clone(bio);
  second.id = 'bio-second'; second.presetKey = 'cal_natural_second';
  second.f.calendarEventKey = 'primary:bio-second'; second.f.start = '30'; second.f.end = '32';
  const parent = { ...bio, f: { ...bio.f, groupedWorkEntries: [bio, second] } };
  const existing = clone(parent);
  existing.f.groupedWorkEntries[0].f.start = '45';
  existing.f.groupedWorkEntries[0].f.end = '62';
  existing.f.groupedWorkEntries[1].f.dailyWorkUserFields = { end: '33' };
  const merged = mergeMakeupProgress(parent, existing);
  assert.deepEqual(merged.f.groupedWorkEntries!.map(item => [item.f.start, item.f.end]), [['16', '18'], ['30', '33']]);
});
