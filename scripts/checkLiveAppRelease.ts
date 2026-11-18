import { createHash } from 'node:crypto';
import { offlineAssetPath, offlineDocumentSource, type OfflineRelease } from './pwaBuild.ts';

const base = new URL(process.argv[2] || 'https://myself.liviayeh.dev/');
if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname))) throw new Error('Use the HTTPS app root URL');
if (!base.pathname.endsWith('/') || base.search || base.hash) throw new Error('Use the app root URL with a trailing slash, without query parameters');
const index = await fetch(new URL('app-release.json', base), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
if (!index.ok) throw new Error('Release index: HTTP ' + index.status);
const release = await index.json() as OfflineRelease;
if (!Array.isArray(release.resources) || release.resources.length > 1000) throw new Error('Invalid release index');
const failures: string[] = [];
for (let offset = 0; offset < release.resources.length; offset += 4) {
  const results = await Promise.all(release.resources.slice(offset, offset + 4).map(async row => {
    try {
      if (!offlineAssetPath(row.path)) throw new Error('Unexpected static resource path');
      if (row.source && (!row.path.endsWith('.html') || row.source !== offlineDocumentSource(row.path, row.hash))) throw new Error('Unexpected offline source');
      const response = await fetch(new URL(row.source || row.path, base), { cache: 'reload', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      let bytes: Buffer;
      if (row.source) {
        if (!/application\/json/i.test(response.headers.get('Content-Type') || '')) throw new Error('Expected JSON offline document');
        const payload = await response.json();
        if (typeof payload.html !== 'string') throw new Error('Invalid offline document');
        bytes = Buffer.from(payload.html, 'utf8');
      } else bytes = Buffer.from(await response.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== row.hash) throw new Error('SHA-256 mismatch (deployment or CDN rewrite)');
      return '';
    } catch (error) { return row.path + ': ' + (error instanceof Error ? error.message : String(error)); }
  }));
  failures.push(...results.filter(Boolean));
}
console.log(`Live App v${release.version}: ${release.resources.length} checked, ${failures.length} failed; release ${release.id}`);
for (const failure of failures) console.error(failure);
if (failures.length) process.exitCode = 1;
