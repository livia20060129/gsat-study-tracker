import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BIOLOGY_MASTERY_UPPER_PAGE_MAP,
  BIOLOGY_MASTERY_UPPER_TITLE,
  biologyMasteryUpperPageText,
  BIOLOGY_NEW_KEY_PAGE_MAP,
  biologyNewKeyPageMatches,
  biologyNewKeyPageText,
  CHEMISTRY_NEW_KEY_PAGE_MAP,
  chemistryNewKeyPageMatches,
  chemistryNewKeyPageText,
  EARTH_SCIENCE_NEW_KEY_PAGE_MAP,
  earthScienceNewKeyPageMatches,
  earthScienceNewKeyPageText,
  PHYSICS_NEW_KEY_PAGE_MAP,
  physicsNewKeyPageMatches,
  physicsNewKeyPageText,
} from '../src/data/naturalMaterialPageMaps.ts';
import { builtInMaterialCatalog, materialProgressRows } from '../src/study/materialProgress.ts';
import { catalogRangeText, catalogValidationError } from '../src/study/materialCatalog.ts';

test('Biology Mastery upper catalog covers photographed p.4–279 without gaps or overlapping topic starts', () => {
  const book = builtInMaterialCatalog().find(row => row.title === BIOLOGY_MASTERY_UPPER_TITLE);
  assert.ok(book); assert.equal(book.subject, '生物'); assert.equal(book.total, 279);
  assert.equal(catalogValidationError(book), ''); assert.equal(book.sections.length, 19);
  assert.equal(book.sections[0].start, 4);
  for (let index = 1; index < book.sections.length; index++) assert.equal(book.sections[index].start, book.sections[index - 1].end + 1);
  assert.deepEqual(BIOLOGY_MASTERY_UPPER_PAGE_MAP.filter(row => row[0] === 138 || row[0] === 192).map(row => [row[0], row[1], row[3]]),
    [[138, 138, '主題起頁（要點前）'], [192, 196, '主題起頁（要點前）']]);
});

test('Biology Mastery upper references preserve the single-page nucleic-acid section and exact final boundary', () => {
  const book = builtInMaterialCatalog().find(row => row.title === BIOLOGY_MASTERY_UPPER_TITLE)!;
  const item = { id: 'mastery', type: 'scienceReview', done: false, minutes: '', required: false, f: { subject: '生物', material: book.title, start: '204', end: '205' } };
  assert.match(catalogRangeText(book, item), /核酸的構造.*DNA的構造與複製/);
  assert.match(biologyMasteryUpperPageText(204, 204), /核酸的構造（p\.204）/);
  assert.match(biologyMasteryUpperPageText(263, 279), /遺傳學在生物科技的應用（p\.263–279）/);
  assert.match(biologyMasteryUpperPageText(280, 280), /不在已建立/);
  assert.match(biologyMasteryUpperPageText(1, 3), /不在已建立/);
});

test('Biology Mastery upper progress groups four topics and does not mix another biology edition', () => {
  const book = builtInMaterialCatalog().find(row => row.title === BIOLOGY_MASTERY_UPPER_TITLE)!;
  const rows = materialProgressRows([{ date: '2026-11-18', items: [
    { id: 'mastery', type: 'scienceReview', done: true, minutes: '', required: false, f: { subject: '生物', material: book.title, start: '263', end: '279' } },
    { id: 'other', type: 'scienceReview', done: true, minutes: '', required: false, f: { subject: '生物', material: '新關鍵', start: '4', end: '236' } },
  ] }]);
  const progress = rows.find(row => row.id === book.id)!;
  assert.deepEqual(progress.segments.map(row => row.label), [
    '主題一 細胞的構造與功能（p.4–93）', '主題二 細胞與能量（p.94–137）',
    '主題三 遺傳1～古典遺傳學（p.138–191）', '主題四 遺傳2～分子遺傳學—遺傳物質（p.192–279）',
  ]);
  assert.equal(progress.completionPercent, 6);
  assert.equal(progress.segments[3].completionPercent, 19);
  assert.equal(progress.segments[0].completionPercent, 0);
});

test('Biology New Key covers every printed content page from p.4 through p.236', () => {
  assert.equal(BIOLOGY_NEW_KEY_PAGE_MAP[0][0], 4);
  assert.equal(BIOLOGY_NEW_KEY_PAGE_MAP.at(-1)?.[1], 236);
  for (let index = 1; index < BIOLOGY_NEW_KEY_PAGE_MAP.length; index += 1) {
    assert.equal(BIOLOGY_NEW_KEY_PAGE_MAP[index][0], BIOLOGY_NEW_KEY_PAGE_MAP[index - 1][1] + 1);
  }
});

test('Biology New Key maps a page range across separate photographed topics', () => {
  assert.deepEqual(
    biologyNewKeyPageMatches(38, 41).map(match => [match.start, match.end, match.topic]),
    [
      [38, 40, '主題 8 人體配子的形成與受精卵的發育'],
      [41, 41, '主題 9 單元 1 探討活動'],
    ],
  );
});

test('Biology New Key keeps unnumbered mock and full-review pages out of prior topics', () => {
  assert.match(biologyNewKeyPageText(42, 71), /科學探究練功坊／第一次模考/);
  assert.match(biologyNewKeyPageText(161, 236), /跨科題本、第三次模考與學測/);
  assert.equal(biologyNewKeyPageMatches(237, 237).length, 0);
});

test('Chemistry New Key covers every page from p.2 through the final p.281', () => {
  assert.equal(CHEMISTRY_NEW_KEY_PAGE_MAP[0][0], 2);
  assert.equal(CHEMISTRY_NEW_KEY_PAGE_MAP.at(-1)?.[1], 281);
  for (let index = 1; index < CHEMISTRY_NEW_KEY_PAGE_MAP.length; index += 1) {
    assert.equal(CHEMISTRY_NEW_KEY_PAGE_MAP[index][0], CHEMISTRY_NEW_KEY_PAGE_MAP[index - 1][1] + 1);
  }
});

test('Chemistry New Key maps photographed topic boundaries and supplemental sections', () => {
  assert.deepEqual(
    chemistryNewKeyPageMatches(146, 155).map(match => [match.start, match.end, match.topic]),
    [
      [146, 147, '單元導讀'],
      [148, 154, '主題 1 氧化還原反應'],
      [155, 155, '主題 2 水溶液中的酸鹼反應'],
    ],
  );
  assert.match(chemistryNewKeyPageText(253, 260), /近 5 年重要考題/);
  assert.match(chemistryNewKeyPageText(273, 281), /主題 3 探究實作/);
  assert.equal(chemistryNewKeyPageMatches(282, 282).length, 0);
});

test('Physics New Key covers every page from p.2 through the final p.270', () => {
  assert.equal(PHYSICS_NEW_KEY_PAGE_MAP[0][0], 2);
  assert.equal(PHYSICS_NEW_KEY_PAGE_MAP.at(-1)?.[1], 270);
  for (let index = 1; index < PHYSICS_NEW_KEY_PAGE_MAP.length; index += 1) {
    assert.equal(PHYSICS_NEW_KEY_PAGE_MAP[index][0], PHYSICS_NEW_KEY_PAGE_MAP[index - 1][1] + 1);
  }
});

test('Physics New Key maps photographed boundaries and final practice sections', () => {
  assert.deepEqual(
    physicsNewKeyPageMatches(131, 136).map(match => [match.start, match.end, match.topic]),
    [
      [131, 133, '主題 5 波的反射與折射'],
      [134, 135, '主題 6 波的干涉與繞射'],
      [136, 136, '主題 7 都卜勒效應'],
    ],
  );
  assert.match(physicsNewKeyPageText(241, 251), /諾貝爾獎練功坊/);
  assert.match(physicsNewKeyPageText(252, 270), /科學探究練功坊/);
  assert.equal(physicsNewKeyPageMatches(271, 271).length, 0);
});

test('Earth Science New Key covers every page from p.2 through the final p.260', () => {
  assert.equal(EARTH_SCIENCE_NEW_KEY_PAGE_MAP[0][0], 2);
  assert.equal(EARTH_SCIENCE_NEW_KEY_PAGE_MAP.at(-1)?.[1], 260);
  for (let index = 1; index < EARTH_SCIENCE_NEW_KEY_PAGE_MAP.length; index += 1) {
    assert.equal(EARTH_SCIENCE_NEW_KEY_PAGE_MAP[index][0], EARTH_SCIENCE_NEW_KEY_PAGE_MAP[index - 1][1] + 1);
  }
});

test('Earth Science New Key maps unit boundaries and advanced inquiry details', () => {
  assert.deepEqual(
    earthScienceNewKeyPageMatches(213, 218).map(match => [match.start, match.end, match.topic]),
    [
      [213, 217, '主題 27 全球暖化'],
      [218, 218, '主題 28 永續發展'],
    ],
  );
  assert.match(earthScienceNewKeyPageText(234, 241), /鋒面系統/);
  assert.match(earthScienceNewKeyPageText(234, 241), /月相與日月食/);
  assert.match(earthScienceNewKeyPageText(259, 260), /鐵皮屋的開窗設計/);
  assert.equal(earthScienceNewKeyPageMatches(261, 261).length, 0);
});
