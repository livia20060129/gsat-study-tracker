import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const projectUrl = new URL('../', import.meta.url);

test('Supabase is bundled by Vite instead of loaded from a floating CDN URL', () => {
  const html = readFileSync(new URL('index.html', projectUrl), 'utf8');
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/);
  assert.match(html, /<script type="module" src="\/src\/main\.ts"><\/script>/);
});

test('Supabase dependency uses an exact version', () => {
  const packageJson = JSON.parse(readFileSync(new URL('package.json', projectUrl), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  assert.match(packageJson.dependencies?.['@supabase/supabase-js'] ?? '', /^\d+\.\d+\.\d+$/);
});
