import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const promptHtml = readFileSync(new URL('../public/gpt.prompt.html', import.meta.url), 'utf8');

test('Calendar prompt contains every Natural New Key material identifier', () => {
  const identifiers = [
    'GSAT-NEWKEY-BIO',
    'GSAT-NEWKEY-CHEM',
    'GSAT-NEWKEY-PHYS',
    'GSAT-NEWKEY-EARTH',
  ];

  for (const identifier of identifiers) {
    assert.match(promptHtml, new RegExp(`<code>${identifier}</code>`));
  }
});

test('Calendar prompt keeps per-event identifiers unique', () => {
  assert.match(promptHtml, /主碼後加入日期、週次、主題、課次或回次/);
  assert.match(promptHtml, /GSAT-NEWKEY-BIO-20260919/);
});
