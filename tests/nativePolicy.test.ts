import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeCallbackPage, nativeExternalUrl, safeNativeFilename, NATIVE_AUTH_RETURN_URL } from '../src/native/nativePolicy.ts';

test('native callbacks relay codes into the bundled app and retain the original PKCE handler', () => {
  for (const base of ['https://localhost/privacy.html', 'capacitor://localhost/index.html']) {
    const url = new URL(nativeCallbackPage(NATIVE_AUTH_RETURN_URL + '&code=one-use-code', base)!);
    assert.equal(url.protocol, new URL(base).protocol); assert.equal(url.host, 'localhost');
    assert.equal(url.pathname, '/index.html'); assert.equal(url.searchParams.get('code'), 'one-use-code');
    assert.equal(url.searchParams.get('google_auth'), '1');
  }
  assert.equal(nativeCallbackPage('gsattracker://auth/calendar?calendar=connected', 'https://localhost/summary.html'), 'https://localhost/index.html?calendar=connected');
});
test('native callback routing rejects tokens, unknown targets, duplicate parameters and oversized input', () => {
  for (const url of [
    'https://evil.invalid/callback?google_auth=1&code=code',
    'gsattracker://evil/callback?google_auth=1&code=code',
    'gsattracker://auth:123/callback?google_auth=1&code=code',
    'gsattracker://user@auth/callback?google_auth=1&code=code',
    'gsattracker://auth/callback?google_auth=1&code=code#access_token=secret',
    'gsattracker://auth/callback?google_auth=1&access_token=secret',
    'gsattracker://auth/callback?google_auth=1&code=a&code=b',
    'gsattracker://auth/callback?google_auth=1&code=a&redirect=https://evil.invalid',
    'gsattracker://auth/callback?google_auth=1&code=' + 'x'.repeat(4097),
    'gsattracker://auth/calendar?calendar=connected&access_token=secret',
    'gsattracker://auth/calendar?calendar=connected&calendar=connected',
    'gsattracker://auth/callback', 'gsattracker://auth/not-a-callback?code=a',
  ]) assert.equal(nativeCallbackPage(url, 'https://localhost/index.html'), null, url.slice(0, 100));
});
test('native file names cannot escape the private export cache and external links require credential-free HTTPS', () => {
  assert.equal(safeNativeFilename('../../backup.json'), '_.._backup.json');
  assert.equal(safeNativeFilename('英文單字表.pdf'), '英文單字表.pdf');
  assert.ok(!safeNativeFilename('a\\b/c.json').includes('/'));
  assert.equal(nativeExternalUrl('https://www.oxfordlearnersdictionaries.com/search?q=word'), 'https://www.oxfordlearnersdictionaries.com/search?q=word');
  for (const url of ['javascript:alert(1)','file:///a','http://example.com','https://user:secret@example.com/']) assert.equal(nativeExternalUrl(url), null);
});
