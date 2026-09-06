import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOOK_PAGE_MAPS,
  bookPageMatches,
  bookPageText,
  canonicalPageMappedBook,
  CHINESE_TOPIC_BOOK,
  DEEP_FIFTEEN_BOOK,
  ENGLISH_TOPIC_CLOZE_BOOK,
  ENGLISH_TOPIC_READING_BOOK,
} from '../src/data/bookPageMaps.ts';
import { cloneOriginalItemForMakeup } from '../src/study/makeup.ts';
import type { StudyItem } from '../src/types.ts';

test('identifies every supported book from punctuation and surrounding Calendar text', () => {
  assert.equal(canonicalPageMappedBook('國文｜深耕十五'), DEEP_FIFTEEN_BOOK);
  assert.equal(canonicalPageMappedBook('主題百匯 閱讀寫作新進化'), CHINESE_TOPIC_BOOK);
  assert.equal(canonicalPageMappedBook('英文｜主題百匯：篇章結構．閱讀測驗'), ENGLISH_TOPIC_READING_BOOK);
  assert.equal(canonicalPageMappedBook('【講義版本】主題百匯 克漏字'), ENGLISH_TOPIC_CLOZE_BOOK);
});

test('looks up the requested topic and lesson, level, or round', () => {
  assert.equal(bookPageText(DEEP_FIFTEEN_BOOK, 8, 25), '先秦文學主流與發展｜燭之武退秦師（p.8–25）');
  assert.equal(bookPageText(CHINESE_TOPIC_BOOK, 2, 6), '自我覺察與生命教育｜新手級（p.2–6）');
  assert.equal(bookPageText(ENGLISH_TOPIC_READING_BOOK, 1, 7), '科技生活｜第一回（p.1–7）');
  assert.equal(bookPageText(ENGLISH_TOPIC_CLOZE_BOOK, 2, 4), '新新世代｜第一回（p.2–4）');
});

test('a page range crossing sections lists each affected section with its own clipped pages', () => {
  assert.equal(
    bookPageText(DEEP_FIFTEEN_BOOK, 24, 28),
    '先秦文學主流與發展｜燭之武退秦師（p.24–25）、先秦文學主流與發展｜大同與小康（p.26–28）',
  );
});

test('every book map is ordered and has no overlap or gap inside its mapped textbook pages', () => {
  for (const sections of Object.values(BOOK_PAGE_MAPS)) {
    assert.ok(sections.length > 0);
    for (let index = 1; index < sections.length; index += 1) {
      assert.equal(sections[index].start, sections[index - 1].end + 1);
    }
  }
});

test('an unsupported or out-of-range page has an explicit readable result', () => {
  assert.deepEqual(bookPageMatches('不存在的書', 1, 2), []);
  assert.equal(bookPageText(DEEP_FIFTEEN_BOOK, 1, 1), '頁碼不在已建立的教材本文範圍內。');
});

test('defer keeps book, pages, and therefore the same page mapping after reload', () => {
  const original: StudyItem = {
    id: 'calendar-book-item',
    type: 'chineseReading',
    done: false,
    minutes: '',
    required: true,
    source: 'preset',
    presetKey: 'cal_book_event-1',
    title: `國文｜${DEEP_FIFTEEN_BOOK}`,
    description: 'Google Calendar API',
    deferred: true,
    deferredTargetDay: 5,
    f: { kind: 'book', book: DEEP_FIFTEEN_BOOK, start: '8', end: '25' },
  };
  const deferred = cloneOriginalItemForMakeup(original, {
    id: 'deferred-book-item',
    presetKey: 'deferred_calendar-book-item',
    originDate: '2026-09-03',
  });

  assert.deepEqual(deferred.f, original.f);
  assert.equal(bookPageText(deferred.f.book, deferred.f.start, deferred.f.end), '先秦文學主流與發展｜燭之武退秦師（p.8–25）');
});
