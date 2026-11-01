import assert from 'node:assert/strict';
import test from 'node:test';
import { UNLOCK_3_BOOK } from '../src/data/bookPageMaps.ts';
import { todoStudyDisplay } from '../src/ui/todoStudyDisplay.ts';

test('todo display preserves range controls, scores and notes while removing repeated book and scope text', () => {
  const entry = { title: '英文｜Unlock 3｜Unit 2 The environment（1/2）', description: `${UNLOCK_3_BOOK}｜p.36–46`, details: [
    { label: '教材', value: UNLOCK_3_BOOK }, { label: '書名／冊別', value: UNLOCK_3_BOOK },
    { label: '起始頁', value: '36', editableRange: 'start' as const }, { label: '結束頁', value: '46', editableRange: 'end' as const },
    { label: '主題', value: 'The environment' }, { label: '作文分數', value: '12' }, { label: '錯因／不熟觀念', value: 'The environment' },
  ] };
  const snapshot = JSON.stringify(entry);
  const display = todoStudyDisplay(entry);
  assert.equal(display.title, entry.title);
  assert.equal(display.description, '');
  assert.deepEqual(display.details.map(detail => detail.label), ['起始頁', '結束頁', '作文分數', '錯因／不熟觀念']);
  assert.equal(JSON.stringify(entry), snapshot);
});

test('todo numbered controls replace heading scopes but keep unrelated instructions and different materials', () => {
  const display = todoStudyDisplay({ title: '英文｜自訂教材 第 12 回', description: '先讀 p.99 的範例再作答', details: [
    { label: '起始 回次', value: '12', editableRange: 'start', rangeKind: 'round' },
    { label: '結束 回次', value: '13', editableRange: 'end', rangeKind: 'round' },
    { label: '作文分數', value: '12' }, { label: '講義', value: '另一份參考書' },
  ] });
  assert.equal(display.title, '英文｜自訂教材');
  assert.equal(display.description, '先讀 p.99 的範例再作答');
  assert.equal(display.details.length, 4);
});
