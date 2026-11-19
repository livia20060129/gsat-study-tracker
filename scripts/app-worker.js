/* Generated with one complete release. Authentication and record APIs never enter these caches. */
const RELEASE = __GSAT_RELEASE__;
const BASE = new URL('./', self.location.href);
const CACHE_PREFIX = 'gsat-offline:' + BASE.pathname + ':';
const CACHE = CACHE_PREFIX + 'release:' + RELEASE.id;
const DICTIONARY = CACHE_PREFIX + 'ecdict-v1';
const STATUS = CACHE_PREFIX + 'status';
const STATUS_URL = new URL('offline-install-status.json', BASE).href;
const resources = new Map(RELEASE.resources.map(row => [new URL(row.path, BASE).href, row]));
const pages = new Set(RELEASE.pages);
const MAX_DICTIONARY_ENTRIES = 64;

function problem(code, row, status) {
  const error = new Error('Offline ' + code + ': ' + row.path);
  error.offline = { code, path: row.path, ...(status ? { status } : {}) }; return error;
}
async function checkedBytes(response, row) {
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer()))]
    .map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== row.hash) throw problem('integrity', row);
  return response;
}
async function verifiedResponse(url, row) {
  let response;
  try { response = await fetch(new Request(row.source ? new URL(row.source, BASE).href : url, { cache: 'reload', credentials: 'same-origin' })); }
  catch { throw problem('network', row); }
  if (!response.ok || (response.url && new URL(response.url).origin !== BASE.origin)) throw problem('http', row, response.status);
  if (row.source) {
    if (!/application\/json/i.test(response.headers.get('Content-Type') || '')) throw problem('payload', row);
    let payload;
    try { payload = await response.json(); } catch { throw problem('payload', row); }
    if (typeof payload?.html !== 'string') throw problem('payload', row);
    response = new Response(payload.html, { headers: { ...RELEASE.documentHeaders, 'Content-Type': 'text/html;charset=utf-8' } });
  }
  return checkedBytes(response, row);
}
async function reportFailure(error) {
  const failure = { type: 'GSAT_OFFLINE_FAILURE', base: BASE.href, release: RELEASE.id,
    failure: error.offline || { code: error.name === 'QuotaExceededError' ? 'quota' : 'cache', path: '' } };
  try { await (await caches.open(STATUS)).put(STATUS_URL, new Response(JSON.stringify(failure), { headers: { 'Content-Type': 'application/json' } })); } catch { /* A full cache may not hold diagnostics. */ }
  try {
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      if (client.url.startsWith(BASE.href)) client.postMessage(failure);
    }
  } catch { /* Failed installation still rejects even if its window has closed. */ }
}

function resourceUrl(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)
      || request.headers.has('Authorization') || request.headers.has('Range')) return null;
  const relative = url.pathname.slice(BASE.pathname.length);
  // A callback still loads the same static app version; its query stays only in the
  // browser location for the auth client. Never cache an authorization/API URL.
  if (request.mode !== 'navigate' && [...url.searchParams.keys()].some(key => /^(?:code|state|error|google_auth|access_token|refresh_token)$/i.test(key))) return null;
  let path = relative;
  if (request.mode === 'navigate') {
    path = relative === '' ? 'index.html' : relative.endsWith('.html') ? relative : relative + '.html';
    if (!pages.has(path)) return null;
  }
  const canonical = new URL(path, BASE).href;
  if (resources.has(canonical)) return { canonical, dictionary: false };
  if (!url.search && /^assets\/[^/]+-[\w-]+\.(?:js|css|json|png)$/.test(relative)) return { canonical, dictionary: false };
  if (!url.search && /^dictionaries\/ecdict-v1\/(?:[a-f0-9]{2}|manifest)\.json$/.test(relative)) return { canonical, dictionary: true };
  return null;
}
async function installRelease(repair = false) {
  try {
    const cache = await caches.open(CACHE);
    // Bounded batches avoid hundreds of simultaneous requests on mobile connections.
    const rows = [...resources];
    for (let offset = 0; offset < rows.length; offset += 4) {
      const results = await Promise.allSettled(rows.slice(offset, offset + 4).map(async ([url, row]) => {
        let response;
        if (repair) { try { const saved = await cache.match(url); if (saved) response = await checkedBytes(saved, row); } catch { /* Repair changed cached bytes from the verified source. */ } }
        response ||= await verifiedResponse(url, row);
        try { await cache.put(url, response); }
        catch (error) { throw problem(error.name === 'QuotaExceededError' ? 'quota' : 'cache', row); }
      }));
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
    }
    try { await (await caches.open(STATUS)).delete(new Request(STATUS_URL)); } catch { /* Diagnostic cleanup is optional. */ }
  } catch (error) {
    await reportFailure(error);
    if (!repair) { try { await caches.delete(CACHE); } catch { /* Preserve the failure reason. */ } }
    throw error;
  }
}
self.addEventListener('install', event => event.waitUntil(installRelease()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const old = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX + 'release:') && name !== CACHE);
  // Keep one previous release for a retiring tab's already-loaded, hashed imports.
  await Promise.all(old.slice(0, -1).map(name => caches.delete(name)));
  // Do not claim or reload pages that loaded without this worker.
})()));
async function staticResponse(request, route) {
  const cache = await caches.open(route.dictionary ? DICTIONARY : CACHE);
  const saved = await cache.match(route.canonical);
  if (saved) return saved;
  if (!route.dictionary) {
    const resource = resources.get(route.canonical);
    if (resource) {
      try { const response = await verifiedResponse(route.canonical, resource); await cache.put(route.canonical, response.clone()); return response; }
      catch { /* A missing old file cannot be replaced with a different release's bytes. */ }
    }
    // Only immutable hashed assets can be recovered from the immediately previous release.
    if (/\/assets\/[^/]+-[\w-]+\.(?:js|css|json|png)$/.test(route.canonical)) {
      const keys = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX + 'release:') && name !== CACHE);
      for (const name of keys.reverse()) { const previous = await (await caches.open(name)).match(route.canonical); if (previous) return previous; }
    }
    // Never substitute a fresh document into an incomplete old release.
    return new Response('離線檔案暫時無法讀取，請連線後在「安裝與更新」重新準備。', { status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
  }
  const response = await fetch(request);
  if (response.ok && !response.redirected && /application\/json/i.test(response.headers.get('Content-Type') || '')) {
    try {
      await cache.put(route.canonical, response.clone());
      const keys = await cache.keys();
      for (const key of keys.slice(0, Math.max(0, keys.length - MAX_DICTIONARY_ENTRIES))) await cache.delete(key);
    } catch { /* Cache quota must never turn a successful lookup into a failure. */ }
  }
  return response;
}
self.addEventListener('fetch', event => {
  const route = resourceUrl(event.request);
  if (route) event.respondWith(staticResponse(event.request, route));
});
self.addEventListener('message', event => {
  const port = event.ports[0];
  if (!port) return;
  if (event.data?.type === 'GSAT_RELEASE') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const keys = new Set((await cache.keys()).map(request => request.url));
      port.postMessage({ version: RELEASE.version, id: RELEASE.id, ready: [...resources.keys()].every(url => keys.has(url)) });
    })()); return;
  }
  if (event.data?.type === 'GSAT_PREPARE') {
    event.waitUntil(installRelease(true).then(() => port.postMessage({ ready: true }), () => port.postMessage({ error: '離線檔案未準備完整，請檢查網路與容量後重試。' })));
    return;
  }
  if (event.data?.type !== 'GSAT_APPLY_UPDATE') return;
  event.waitUntil((async () => {
    const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(client => client.url.startsWith(BASE.href));
    if (!event.source?.id || windows.length !== 1 || windows[0].id !== event.source.id) {
      port.postMessage({ error: '請先關閉此網站或 App 的其他分頁／視窗，再更新。' }); return;
    }
    port.postMessage({ accepted: true });
    await self.skipWaiting();
  })());
});
