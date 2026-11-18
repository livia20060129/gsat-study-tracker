import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { offlineAssetPath, type OfflineRelease } from './pwaBuild.ts';

const root = resolve('dist');
const release = JSON.parse(readFileSync(resolve(root, 'app-release.json'), 'utf8')) as OfflineRelease;
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(release.version, pkg.version, 'Offline release must match the app package');
assert.match(release.id, /^[a-f0-9]{20}$/);
assert.equal(new Set(release.resources.map(row => row.path)).size, release.resources.length);
assert.deepEqual(release.pages, release.resources.filter(row => row.path.endsWith('.html')).map(row => row.path));
let bytes = 0;
for (const resource of release.resources) {
  const file = resolve(root, resource.path);
  assert.ok(file.startsWith(root + sep) && offlineAssetPath(resource.path), 'Unexpected release resource: ' + resource.path);
  const content = readFileSync(file);
  assert.equal(content.length, resource.bytes, resource.path + ': size mismatch');
  assert.equal(createHash('sha256').update(content).digest('hex'), resource.hash, resource.path + ': hash mismatch');
  bytes += content.length;
}
for (const required of ['index.html', 'todo.html', 'summary.html', 'material.progress.html', 'vocabulary.review.html', 'gpt.prompt.html']) {
  assert.ok(release.pages.includes(required), required + ': missing offline entry');
}
const worker = readFileSync(resolve(root, 'app-worker.js'), 'utf8');
assert.ok(worker.includes('const RELEASE = ' + JSON.stringify(release) + ';'), 'Worker and release index differ');
assert.ok(!worker.includes('__GSAT_RELEASE__'), 'Unbuilt worker template');
assert.match(readFileSync(resolve(root, '_headers'), 'utf8'), /\/app-worker\.js\n[\s\S]*Cache-Control: no-cache, no-store/);
console.log(`App v${release.version}: ${release.pages.length} pages, ${release.resources.length} verified files, ${(bytes / 1048576).toFixed(2)} MB; release ${release.id}`);
