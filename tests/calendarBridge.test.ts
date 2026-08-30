import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calendarDescriptionText,
  calendarStructuredNote,
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

test('reads explicit Calendar page ranges for every natural-science subject', () => {
  for (const subject of ['物理', '化學', '生物', '地科'] as const) {
    const parsed = parseCalendarTask(row(
      `${subject}｜牛頓定律、摩擦與圓周運動`,
      '【頁碼範圍】80–88頁\n【單元進度】／\n【重點】牛頓定律\n【來源日期】8/31\n【識別碼】natural-01',
      'natural',
    ));
    assert.equal(parsed.kind, 'natural', subject);
    if (parsed.kind === 'natural') {
      assert.equal(parsed.subject, subject);
      assert.equal(parsed.material, '');
      assert.equal(parsed.startPage, 80);
      assert.equal(parsed.endPage, 88);
    }
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

test('reads every field from the standardized Calendar note', () => {
  const note = calendarStructuredNote(`
【冊別】2＋4A
【頁碼範圍】p.174–181
【單元進度】／
【重點】多項式函數與運算
【來源日期】8/26
【識別碼】math-polynomial-01
  `);

  assert.deepEqual(note, {
    book: '2＋4A',
    pageRange: 'p.174–181',
    unitProgress: '',
    focus: '多項式函數與運算',
    sourceDate: '8/26',
    identifier: 'math-polynomial-01',
    hasStandardFields: true,
  });
});

test('standard page range wins and unit progress is ignored when both are present', () => {
  const parsed = parseCalendarTask(row(
    '2＋4A｜多項式函數',
    `【冊別】2＋4A
【頁碼範圍】174–181
【單元進度】3/11
【重點】備註中的其他數字 p.999 不得干擾
【來源日期】8/26
【識別碼】math-polynomial-01`,
    'math',
  ));

  assert.equal(parsed.kind, 'math');
  assert.equal(parsed.identifier, 'math-polynomial-01');
  assert.equal(parsed.sourceDate, '8/26');
  assert.equal(parsed.makeup, true);
  if (parsed.kind === 'math') {
    assert.equal(parsed.book, '2＋4A');
    assert.equal(parsed.startPage, 174);
    assert.equal(parsed.endPage, 181);
    assert.equal(parsed.progressIndex, null);
    assert.equal(parsed.progressTotal, null);
  }
});

test('uses unit progress only when the standardized page-range field is empty', () => {
  const parsed = parseCalendarTask(row(
    '1｜多項式函數',
    `【冊別】1
【頁碼範圍】／
【單元進度】3/11
【重點】自由文字 p.999 不得被當成頁碼
【來源日期】8/31
【識別碼】math-unit-progress-03`,
    'math',
  ));

  assert.equal(parsed.kind, 'math');
  assert.equal(parsed.makeup, undefined);
  if (parsed.kind === 'math') {
    assert.equal(parsed.title, '1｜多項式函數');
    assert.equal(parsed.startPage, null);
    assert.equal(parsed.endPage, null);
    assert.equal(parsed.progressIndex, 3);
    assert.equal(parsed.progressTotal, 11);
  }
});

test('standardized natural-science notes keep the unit name in the title', () => {
  const parsed = parseCalendarTask(row(
    '物理｜牛頓定律、摩擦與圓周運動',
    `【頁碼範圍】80–88
【單元進度】／
【重點】自由文字 p.999 不得干擾
【來源日期】8/31
【識別碼】physics-newton-01`,
    'natural',
  ));

  assert.equal(parsed.kind, 'natural');
  if (parsed.kind === 'natural') {
    assert.equal(parsed.topic, '牛頓定律、摩擦與圓周運動');
    assert.equal(parsed.startPage, 80);
    assert.equal(parsed.endPage, 88);
  }
});

test('standardized page ranges apply to English grammar and fixed page templates', () => {
  const description = `【頁碼範圍】20–25
【單元進度】／
【重點】關係詞
【來源日期】8/31
【識別碼】page-template-01`;
  const grammar = parseCalendarTask(row('英文文法｜關係詞', description, 'grammar'));
  const fixed = parseCalendarTask(row('數學講義：進度', description));

  assert.equal(grammar.kind, 'grammar');
  if (grammar.kind === 'grammar') {
    assert.equal(grammar.startPage, 20);
    assert.equal(grammar.endPage, 25);
    assert.equal(grammar.focus, '關係詞');
  }
  assert.equal(fixed.kind, 'fixedTemplate');
  if (fixed.kind === 'fixedTemplate') {
    assert.equal(fixed.startPage, 20);
    assert.equal(fixed.endPage, 25);
  }
});

test('non-math standardized notes may omit both book and focus fields', () => {
  const parsed = parseCalendarTask(row(
    '英文文法｜Ch.3 被動語態',
    `【頁碼範圍】28–44
【單元進度】／
【來源日期】8/31
【識別碼】grammar-passive-01`,
    'grammar',
  ));

  assert.equal(parsed.kind, 'grammar');
  if (parsed.kind === 'grammar') {
    assert.equal(parsed.startPage, 28);
    assert.equal(parsed.endPage, 44);
    assert.equal(parsed.focus, '');
  }
});
