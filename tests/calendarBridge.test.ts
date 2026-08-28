import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calendarDescriptionText,
  parseCalendarTask,
  type CalendarTaskRow,
} from '../src/calendar/calendarBridge.ts';

function row(title: string, description = '', category = 'other'): CalendarTaskRow {
  return {
    event_key: 'primary:event-1',
    source_event_id: 'event-1',
    calendar_id: 'primary',
    event_date: '2026-08-31',
    title,
    description,
    category,
  };
}

test('parses an Essential Grammar unit range into individual units', () => {
  const parsed = parseCalendarTask(row('Essential Grammar in Use｜Unit 12–14'));
  assert.equal(parsed.kind, 'essentialGrammar');
  if (parsed.kind === 'essentialGrammar') assert.deepEqual(parsed.units, [12, 13, 14]);
});

test('parses separate Essential Grammar units from the description', () => {
  const parsed = parseCalendarTask(row('Essential Grammar in Use', 'Unit：1、3、5'));
  assert.equal(parsed.kind, 'essentialGrammar');
  if (parsed.kind === 'essentialGrammar') assert.deepEqual(parsed.units, [1, 3, 5]);
});

test('does not create Essential Grammar units beyond Unit 115', () => {
  const parsed = parseCalendarTask(row('Essential Grammar in Use｜Unit 114–118'));
  assert.equal(parsed.kind, 'essentialGrammar');
  if (parsed.kind === 'essentialGrammar') assert.deepEqual(parsed.units, [114, 115]);
});

test('routes prefixed Calendar items to today or this week', () => {
  const today = parseCalendarTask(row('今日項目｜英文單字複習'));
  const week = parseCalendarTask(row('本週項目｜整理自然錯題'));
  assert.equal(today.kind, 'calendarItem');
  assert.equal(today.route, 'today');
  assert.equal(today.title, '英文單字複習');
  assert.equal(week.kind, 'calendarItem');
  assert.equal(week.route, 'week');
  assert.equal(week.title, '整理自然錯題');
});

test('routes unprefixed Calendar items to today', () => {
  const generic = parseCalendarTask(row('整理化學錯題'));
  const essentialGrammar = parseCalendarTask(row('Essential Grammar in Use｜Unit 20'));
  assert.equal(generic.kind, 'calendarItem');
  assert.equal(generic.route, 'today');
  assert.equal(essentialGrammar.route, 'today');
});

test('routes Essential Grammar to this week only with the weekly prefix', () => {
  const weekly = parseCalendarTask(row('本週項目｜Essential Grammar in Use｜Unit 21'));
  assert.equal(weekly.kind, 'essentialGrammar');
  assert.equal(weekly.route, 'week');
});

test('routes Calendar makeup to today and preserves a recognized item template', () => {
  const makeup = parseCalendarTask(row('補做｜Essential Grammar in Use｜Unit 22'));
  assert.equal(makeup.kind, 'essentialGrammar');
  assert.equal(makeup.route, 'today');
  assert.equal(makeup.makeup, true);
  assert.equal(makeup.title, 'Essential Grammar in Use｜Unit 22');
});

test('Calendar makeup overrides a weekly prefix and goes to today', () => {
  const makeup = parseCalendarTask(row('本週項目｜補做項目｜整理自然錯題'));
  assert.equal(makeup.kind, 'calendarItem');
  assert.equal(makeup.route, 'today');
  assert.equal(makeup.makeup, true);
  assert.equal(makeup.title, '整理自然錯題');
});

test('recognizes special fixed templates read from Calendar', () => {
  const englishReview = parseCalendarTask(row('補做｜英文訂正與搭配詞整理'));
  const interactive = parseCalendarTask(row('補做｜互動題'));
  const magazine = parseCalendarTask(row('補做｜學測英文訓練：英文雜誌'));

  assert.equal(englishReview.kind, 'fixedTemplate');
  assert.equal(interactive.kind, 'fixedTemplate');
  assert.equal(magazine.kind, 'fixedTemplate');
  if (englishReview.kind === 'fixedTemplate') assert.equal(englishReview.template, 'englishReview');
  if (interactive.kind === 'fixedTemplate') assert.equal(interactive.template, 'interactiveDaily');
  if (magazine.kind === 'fixedTemplate') assert.equal(magazine.template, 'fixedMagazine');
  assert.equal(englishReview.route, 'today');
  assert.equal(interactive.route, 'today');
  assert.equal(magazine.route, 'today');
  assert.equal(englishReview.makeup, true);
  assert.equal(interactive.makeup, true);
  assert.equal(magazine.makeup, true);
});

test('keeps the magazine template when date and makeup notes are appended', () => {
  const parsed = parseCalendarTask(row('學測英文訓練：英文雜誌｜8/28＋補做8/26'));

  assert.equal(parsed.kind, 'fixedTemplate');
  if (parsed.kind === 'fixedTemplate') assert.equal(parsed.template, 'fixedMagazine');
  assert.equal(parsed.route, 'today');
  assert.equal(parsed.makeup, true);
});

test('canonicalizes the Calendar mock delimiter to the built-in timed template', () => {
  const parsed = parseCalendarTask(row('英文歷屆／模考｜限時作答'));

  assert.equal(parsed.kind, 'fixedTemplate');
  if (parsed.kind === 'fixedTemplate') assert.equal(parsed.template, 'englishMockTimed');
});

test('recognizes every fixed Calendar template with an appended note', () => {
  const cases = [
    ['數學講義：進度｜8/28', 'mathStudy'],
    ['數學講義題目：理解檢查＋錯題標記＋訂正｜8/28', 'mathPractice'],
    ['互動題｜8/28', 'interactiveDaily'],
    ['英文訂正與搭配詞整理｜8/28', 'englishReview'],
    ['英文：混合題與作文練習｜8/28', 'englishMixedWriting'],
    ['英文歷屆／模考：批改與訂正｜8/28', 'englishMockCorrection'],
    ['本週完成度與錯題整理｜8/28', 'weekReview'],
    ['英文輕量閱讀｜8/28', 'englishLightReading'],
  ] as const;

  for (const [title, template] of cases) {
    const parsed = parseCalendarTask(row(title));
    assert.equal(parsed.kind, 'fixedTemplate', title);
    if (parsed.kind === 'fixedTemplate') assert.equal(parsed.template, template, title);
  }
});

test('restores fixed templates after the same Calendar item is deferred more than once', () => {
  const math = parseCalendarTask(row(
    '數學講義題目｜理解檢查＋錯題標記＋訂正',
    '日麻花卷 8/25 欠項。針對本週已完成的數學講義進行理解檢查。',
  ));
  const english = parseCalendarTask(row('英文混合題與作文｜補8/26＋8/29'));

  assert.equal(math.kind, 'fixedTemplate');
  if (math.kind === 'fixedTemplate') assert.equal(math.template, 'mathPractice');
  assert.equal(english.kind, 'fixedTemplate');
  if (english.kind === 'fixedTemplate') assert.equal(english.template, 'englishMixedWriting');
  assert.equal(english.makeup, true);
  assert.equal(english.route, 'today');
  assert.equal(english.sourceDate, '8/26');
});

test('recognizes a deferred math event from a standard title and note-only metadata', () => {
  const parsed = parseCalendarTask(row(
    '1｜多項式函數',
    '<p>【延期來源】8/25　【範圍】第一冊數學講義 p.149–157　【單元】多項式函數</p>',
    'studyItem',
  ));

  assert.equal(parsed.kind, 'math');
  assert.equal(parsed.makeup, true);
  assert.equal(parsed.route, 'today');
  assert.equal(parsed.sourceDate, '8/25');
  assert.equal(parsed.title, '1｜多項式函數');
  assert.doesNotMatch(parsed.description, /<\/?p>/);
  if (parsed.kind === 'math') {
    assert.equal(parsed.book, '1');
    assert.equal(parsed.startPage, 149);
    assert.equal(parsed.endPage, 157);
  }
});

test('recognizes deferred Gujin and writing from standard titles and note-only source dates', () => {
  const gujin = parseCalendarTask(row(
    '古今悅讀一百｜第 10 回＋訂正',
    '<p>【延期來源】8/26　【第 10–11 回延期】本行程只完成第 10 回</p>',
    'studyItem',
  ));
  const writing = parseCalendarTask(row(
    '英文寫作測驗｜第 1 回：讓步、原因與條件',
    '<p>【延期來源】8/26　【教材】英文寫作測驗</p>',
    'studyItem',
  ));

  assert.equal(gujin.kind, 'gujin');
  assert.equal(gujin.makeup, true);
  assert.equal(gujin.sourceDate, '8/26');
  if (gujin.kind === 'gujin') assert.deepEqual(gujin.rounds, [10]);
  assert.equal(writing.kind, 'writing');
  assert.equal(writing.makeup, true);
  assert.equal(writing.sourceDate, '8/26');
  if (writing.kind === 'writing') {
    assert.equal(writing.round, 1);
    assert.equal(writing.focus, '讓步、原因與條件');
  }
});

test('converts Calendar rich text to readable plain text', () => {
  assert.equal(
    calendarDescriptionText('<p>第一行&nbsp;&amp;內容</p><p>第二行<br>第三行</p>'),
    '第一行 &內容\n第二行\n第三行',
  );
});
