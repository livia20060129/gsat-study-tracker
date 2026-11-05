import assert from 'node:assert/strict';
import test from 'node:test';
import { translationText } from '../supabase/functions/_shared/translationText.ts';

test('whole English retains case and context while counting words rather than characters', () => {
  for (const [text, words] of [['look after', 2], ['Practice makes perfect.', 3], ["Don't give up!", 3],
    ['My mother-in-law is 65.', 3], ['US or us?', 3], ['B2B sales', 2]] as const) {
    assert.deepEqual(translationText(text), { text, words });
  }
  assert.deepEqual(translationText('  Don’t\n give up!  '), { text: "Don't give up!", words: 3 });
});

test('whole English has bounded input and requires English rather than markup or another script', () => {
  for (const value of [null, '', '1234', '你好', '<b>word</b>', 'word\u0000', 'word '.repeat(201), 'a'.repeat(1001)]) {
    assert.equal(translationText(value), null);
  }
  assert.equal(translationText('a '.repeat(200))?.words, 200);
  assert.equal(translationText('a'.repeat(1000))?.words, 1);
});
