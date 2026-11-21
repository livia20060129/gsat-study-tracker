import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { offlineAssetPath, offlineWorkerSource, type OfflineRelease } from '../scripts/pwaBuild.ts';
import { prepareAppUpdate } from '../src/application/prepareAppUpdate.ts';
import { offlineFailureMessage } from '../src/ui/offlineFailure.ts';

function workerFixture(options: { base?: string; broken?: boolean; quota?: boolean; cacheQuota?: boolean; transport?: boolean; htmlTransform?: boolean; missingPayload?: boolean; onFailure?: () => void } = {}) {
  const base = options.base ?? 'https://tracker.example/app/';
  const data = new Map([['index.html', '<html>one complete version</html>'], ['todo.html', '<html>todo</html>'],
    ['assets/tracker-abc123.js', 'console.log("app")']]);
  const release: OfflineRelease = { version: 'test', id: 'release-a', pages: ['index.html', 'todo.html'],
    resources: [...data].map(([path, content]) => ({ path, bytes: content.length, hash: createHash('sha256').update(content).digest('hex'),
      ...(options.transport && path.endsWith('.html') ? { source: 'offline-pages/' + path + '.json' } : {}) })),
    documentHeaders: { 'Content-Security-Policy': "script-src 'self'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY' } };
  const stores = new Map<string, Map<string, Response>>(), network: string[] = [];
  const handlers = new Map<string, (event: any) => void>();
  let clients: { id: string; url: string; postMessage?: (value: unknown) => void }[] = [{ id: 'tab-one', url: base + 'index.html', postMessage: () => options.onFailure?.() }], skipped = 0;
  const cacheApi = (name: string) => {
    const rows = stores.get(name) ?? new Map<string, Response>(); stores.set(name, rows);
    return { async match(key: string | Request) { return rows.get(typeof key === 'string' ? key : key.url)?.clone(); },
      async put(key: string, response: Response) {
        if (options.quota && name.endsWith('ecdict-v1')) throw new Error('quota');
        if (options.cacheQuota && name.includes(':release:')) throw new DOMException('full', 'QuotaExceededError');
        rows.set(key, response.clone());
      },
      async keys() { return [...rows.keys()].map(url => new Request(url)); },
      async delete(key: Request) { return rows.delete(key.url); } };
  };
  const self = { location: { href: base + 'app-worker.js' }, addEventListener(type: string, handler: (event: any) => void) { handlers.set(type, handler); },
    clients: { async matchAll() { return clients; } }, async skipWaiting() { skipped++; } };
  runInNewContext(offlineWorkerSource(release), { self, crypto, URL, Request, Response, Map, Set, Uint8Array,
    caches: { async has(name: string) { return stores.has(name); }, async open(name: string) { return cacheApi(name); }, async keys() { return [...stores.keys()]; }, async delete(name: string) { return stores.delete(name); } },
    async fetch(request: Request) {
      network.push(request.url);
      const relative = request.url.slice(base.length).split('?')[0];
      if (relative.startsWith('offline-pages/')) {
        if (options.missingPayload) return new Response('missing', { status: 404 });
        const path = relative.slice('offline-pages/'.length, -'.json'.length);
        const html = options.broken && path === 'todo.html' ? 'different release' : data.get(path);
        return new Response(JSON.stringify({ html }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (relative.startsWith('dictionaries/')) return new Response('{"word":"意思"}', { headers: { 'Content-Type': 'application/json' } });
      if (!data.has(relative)) throw new Error('offline');
      const html = options.htmlTransform && relative.endsWith('.html') ? '<script>window.__CF$cv$params={r:"test"};</script>' : '';
      return new Response((options.broken && relative === 'todo.html' ? 'different release' : data.get(relative)) + html);
    } });
  async function dispatch(type: string, detail = {}) {
    const work: Promise<unknown>[] = [];
    handlers.get(type)!({ ...detail, waitUntil(value: Promise<unknown>) { work.push(value); } });
    await Promise.all(work);
  }
  async function response(path: string, extra: object = {}): Promise<Response | undefined> {
    let result: Promise<Response> | undefined;
    handlers.get('fetch')!({ request: { url: new URL(path, base).href, method: 'GET', headers: new Headers(), ...extra },
      respondWith(value: Promise<Response>) { result = value; } });
    return result;
  }
  async function message(type: string, sourceId = 'tab-one') {
    let answer: any;
    await dispatch('message', { data: { type }, source: { id: sourceId }, ports: [{ postMessage(value: unknown) { answer = value; } }] });
    return answer;
  }
  return { base, stores, network, dispatch, response, message, skipped: () => skipped,
    clients(value: typeof clients) { clients = value; } };
}

test('offline assets include actual app entries and omit archives, dictionaries, API files and secrets', () => {
  for (const path of ['index.html', 'gpt.prompt.html', 'assets/tracker-123.js', 'assets/ceecCoreMeanings-123.json', 'fonts/NotoSansTC-Regular.ttf']) assert.equal(offlineAssetPath(path), true, path);
  for (const path of ['GSAT_Google_Calendar_Prompt_latest_2026-09-16.html', '.env', 'supabase/config.toml', 'dictionaries/ecdict-v1/00.json', 'private/records.json', 'notes.html']) assert.equal(offlineAssetPath(path), false, path);
});
test('a complete verified release serves offline pages with clean routes and preserves date queries at the browser', async () => {
  const f = workerFixture(); await f.dispatch('install'); await f.dispatch('activate');
  const fetched = f.network.length;
  for (const path of ['', 'index.html?date=2026-11-18', 'todo?period=week']) {
    const response = await f.response(path, { mode: 'navigate' }); assert.ok(response?.ok); assert.match(await response.text(), /<html>/);
  }
  assert.equal(f.network.length, fetched); assert.equal(f.skipped(), 0);
  assert.ok([...f.stores.values()].every(rows => [...rows.keys()].every(key => !key.includes('?'))));
});
test('offline handling respects scope and excludes private APIs while never retaining OAuth callback queries', async () => {
  const f = workerFixture(); await f.dispatch('install');
  for (const path of ['https://other.example/app/index.html', '/outside/index.html', 'auth/v1/token', 'rest/v1/study_records',
    'functions/v1/google-translation', 'unrecognized', 'app-release.json']) {
    assert.equal(await f.response(path, { mode: 'navigate' }), undefined, path);
  }
  assert.ok((await f.response('index.html?google_auth=1&code=secret', { mode: 'navigate' }))?.ok);
  assert.equal(await f.response('index.html?state=secret'), undefined);
  assert.ok([...f.stores.values()].every(rows => [...rows.keys()].every(key => !key.includes('secret'))));
  assert.equal(await f.response('index.html', { method: 'POST' }), undefined);
  assert.equal(await f.response('index.html', { headers: new Headers({ Authorization: 'Bearer secret' }) }), undefined);
  assert.equal(await f.response('assets/tracker-abc123.js', { headers: new Headers({ Range: 'bytes=0-9' }) }), undefined);
});
test('a partially deployed release fails installation and removes only its own incomplete cache', async () => {
  const f = workerFixture({ broken: true }); f.stores.set('unrelated-cache', new Map());
  f.stores.set('gsat-offline:/app/:release:previous', new Map());
  await assert.rejects(f.dispatch('install'), /integrity/);
  assert.deepEqual([...f.stores.keys()], ['unrelated-cache', 'gsat-offline:/app/:release:previous', 'gsat-offline:/app/:status']);
  assert.equal(f.skipped(), 0);
});
test('CDN-transformed HTML cannot invalidate exact offline copies, whose bytes and security headers are retained', async () => {
  const f = workerFixture({ transport: true, htmlTransform: true }); await f.dispatch('install');
  const response = await f.response('index.html', { mode: 'navigate' });
  assert.equal(await response?.text(), '<html>one complete version</html>');
  assert.equal(response?.headers.get('X-Frame-Options'), 'DENY');
  assert.match(response?.headers.get('Content-Security-Policy') ?? '', /frame-ancestors 'none'/);
  assert.ok(f.network.some(url => url.endsWith('offline-pages/index.html.json')));
  assert.ok(!f.network.some(url => /\/index\.html$/.test(url)));
});
test('a failed installation removes its cache before notifying the app while retaining the previous release', async () => {
  const observedCaches: boolean[] = [];
  const key = 'gsat-offline:/app/:release:release-a';
  const f = workerFixture({ broken: true, onFailure: () => { observedCaches.push(f.stores.has(key)); } });
  const previous = new Map<string, Response>([[f.base + 'index.html', new Response('previous release')]]);
  f.stores.set('gsat-offline:/app/:release:previous', previous);
  await assert.rejects(f.dispatch('install'), /integrity/);
  assert.deepEqual(observedCaches, [false]);
  assert.equal((await f.message('GSAT_RELEASE')).ready, false);
  assert.equal(f.stores.has(key), false);
  assert.equal([...f.stores.keys()].some(name => name.includes(':installing:')), false);
  assert.equal(f.stores.get('gsat-offline:/app/:release:previous'), previous);
});

test('a changed offline copy still fails integrity and records the exact failed page', async () => {
  const f = workerFixture({ transport: true, broken: true });
  await assert.rejects(f.dispatch('install'), /integrity.*todo\.html/);
  const entry = f.stores.get('gsat-offline:/app/:status')!.values().next().value!;
  const status = await entry.json();
  assert.deepEqual(status.failure, { code: 'integrity', path: 'todo.html' });
  assert.equal(f.stores.has('gsat-offline:/app/:release:release-a'), false);
});
test('missing files and a full cache produce different diagnostics without clearing previous data', async () => {
  for (const [options, code] of [[{ transport: true, missingPayload: true }, 'http'], [{ cacheQuota: true }, 'quota']] as const) {
    const f = workerFixture(options); f.stores.set('previous-data', new Map());
    await assert.rejects(f.dispatch('install'));
    const status = await f.stores.get('gsat-offline:/app/:status')!.values().next().value!.json();
    assert.equal(status.failure.code, code); assert.equal(status.failure.path, 'index.html');
    assert.equal(f.stores.has('previous-data'), true);
    assert.ok(offlineFailureMessage(status.failure).includes('index.html'));
    assert.equal(offlineFailureMessage(status.failure).includes('容量不足'), code === 'quota');
  }
});
test('release activation retains the previous asset version and does not clear dictionary or foreign caches', async () => {
  const f = workerFixture();
  f.stores.set('gsat-offline:/app/:installing:abandoned', new Map());
  for (const name of ['gsat-offline:/other/:release:foreign', 'gsat-offline:/app/:release:ancient', 'gsat-offline:/app/:release:previous', 'gsat-offline:/app/:ecdict-v1']) f.stores.set(name, new Map());
  f.stores.get('gsat-offline:/app/:release:previous')!.set(f.base + 'assets/old-xyz123.js', new Response('previous import'));
  await f.dispatch('install'); await f.dispatch('activate');
  assert.equal(f.stores.has('gsat-offline:/app/:release:ancient'), false);
  assert.equal(f.stores.has('gsat-offline:/app/:installing:abandoned'), false);
  assert.equal(f.stores.has('gsat-offline:/other/:release:foreign'), true);
  assert.equal(f.stores.has('gsat-offline:/app/:ecdict-v1'), true);
  assert.equal(await (await f.response('assets/old-xyz123.js'))?.text(), 'previous import');
});
test('only requested ECDICT shards are cached, are bounded and remain usable without another request', async () => {
  const f = workerFixture(); await f.dispatch('install');
  for (let index = 0; index < 65; index++) await f.response(`dictionaries/ecdict-v1/${index.toString(16).padStart(2, '0')}.json`);
  const rows = f.stores.get('gsat-offline:/app/:ecdict-v1')!;
  assert.equal(rows.size, 64); assert.equal(rows.has(f.base + 'dictionaries/ecdict-v1/00.json'), false);
  const before = f.network.length;
  assert.ok((await f.response('dictionaries/ecdict-v1/40.json'))?.ok); assert.equal(f.network.length, before);
  assert.equal(await f.response('dictionaries/ecdict-v1/private.json'), undefined);
});
test('dictionary cache quota failure keeps the successful lookup response', async () => {
  const f = workerFixture({ quota: true });
  const result = await f.response('dictionaries/ecdict-v1/00.json'); assert.ok(result?.ok); assert.match(await result.text(), /意思/);
});
test('a waiting worker accepts updates only from the sole open app client', async () => {
  const f = workerFixture();
  f.clients([{ id: 'tab-one', url: f.base }, { id: 'tab-two', url: f.base + 'todo' }]);
  assert.match((await f.message('GSAT_APPLY_UPDATE')).error, /其他分頁/); assert.equal(f.skipped(), 0);
  f.clients([{ id: 'tab-one', url: f.base }]);
  assert.match((await f.message('GSAT_APPLY_UPDATE', 'unknown-client')).error, /其他分頁/);
  assert.equal((await f.message('GSAT_APPLY_UPDATE')).accepted, true); assert.equal(f.skipped(), 1);
  assert.equal((await f.message('GSAT_RELEASE')).id, 'release-a');
});
test('missing cache entries are reported and can be repaired without clearing records or foreign caches', async () => {
  const f = workerFixture(); await f.dispatch('install');
  const cache = f.stores.get('gsat-offline:/app/:release:release-a')!;
  cache.delete(f.base + 'todo.html');
  assert.equal((await f.message('GSAT_RELEASE')).ready, false);
  const before = f.network.length;
  assert.equal((await f.message('GSAT_PREPARE')).ready, true);
  assert.equal(f.network.length, before + 1);
  assert.equal((await f.message('GSAT_RELEASE')).ready, true);
});
test('a missing current file can recover online only from matching release bytes', async () => {
  const f = workerFixture(); await f.dispatch('install');
  f.stores.get('gsat-offline:/app/:release:release-a')!.delete(f.base + 'todo.html');
  assert.ok((await f.response('todo.html', { mode: 'navigate' }))?.ok);
});
test('updates validate and back up the current draft before requesting activation', async () => {
  const order: string[] = [];
  await prepareAppUpdate({ scope: () => 'guest:', revision: () => 1, saveDraft() { order.push('save'); },
    async backup(prefix) { order.push('backup ' + prefix); }, async activate() { order.push('activate'); } });
  assert.deepEqual(order, ['save', 'backup guest:', 'activate']);
});
test('validation, backup failures, account changes and new input each prevent activation', async () => {
  for (const mode of ['invalid', 'quota', 'scope', 'revision']) {
    let prefix = 'guest:', revision = 1, activated = false;
    await assert.rejects(prepareAppUpdate({ scope: () => prefix, revision: () => revision,
      saveDraft() { if (mode === 'invalid') throw new Error('invalid draft'); },
      async backup() { if (mode === 'quota') throw new Error('quota'); if (mode === 'scope') prefix = 'other:'; if (mode === 'revision') revision++; },
      async activate() { activated = true; } }));
    assert.equal(activated, false, mode);
  }
});
