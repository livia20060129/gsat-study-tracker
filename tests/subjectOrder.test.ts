import assert from 'node:assert/strict';
import test from 'node:test';

import { groupStudyItemsBySubject, studyItemSubject } from '../src/study/subjectOrder.ts';
import type { StudyItem } from '../src/types.ts';

function item(id: string, type: string, title: string, subject = ''): StudyItem {
  return {
    id,
    type,
    title,
    done: false,
    minutes: '',
    required: true,
    source: 'preset',
    f: subject ? { subject } : {},
  };
}

test('辨識 Tracker 主要科目', () => {
  assert.equal(studyItemSubject(item('m', 'mathStudy', '數學講義：進度')), '數學');
  assert.equal(studyItemSubject(item('e', 'extra', 'Essential Grammar in Use')), '英文');
  assert.equal(studyItemSubject(item('c', 'chineseReading', '古今悅讀一百')), '國文');
  assert.equal(studyItemSubject(item('s', 'scienceReview', '自然')), '自然');
  assert.equal(studyItemSubject(item('mock', 'mock', '歷屆／模考', '數學A')), '數學');
});

test('同科目卡片相鄰且維持原本的科目與卡片先後順序', () => {
  const input = [
    item('math-1', 'mathStudy', '數學講義：進度'),
    item('english-1', 'extra', 'Essential Grammar in Use'),
    item('math-2', 'mathPractice', '數學講義題目'),
    item('natural-1', 'scienceReview', '自然'),
    item('english-2', 'magazine', '英文雜誌'),
  ];
  assert.deepEqual(
    groupStudyItemsBySubject(input).map(entry => entry.id),
    ['math-1', 'math-2', 'english-1', 'english-2', 'natural-1'],
  );
});
