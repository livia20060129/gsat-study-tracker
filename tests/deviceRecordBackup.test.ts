import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { captureDeviceRecords, parseDeviceSnapshot, restoreMissingDeviceRecords, deviceRecordHash,
  type DeviceBackupVault, type DeviceRecordCopy, type DeviceRecordSnapshot } from '../src/infrastructure/storage/deviceRecordBackup.ts';
import { compactConfirmedRecordStorage } from '../src/infrastructure/storage/localRecordCompaction.ts';
import { decodeStudyRecord } from '../src/storage/studyRecordCodec.ts';
import { ACTIVE_RECORD_PREFIX_KEY } from '../src/storage/local.ts';
import { siteNavigationPage } from '../src/ui/siteNavigation.ts';

const prefix = 'study-v11:guest:', date = '2026-11-15';
const record = { schemaVersion: 2, date, notes: '保留筆記'.repeat(800), items: [], dirty: true,
  cloudBase: { date, notes: '原始雲端內容', items: [] }, extraLegacy: { preserve: ['字詞', 42] } };

/** Build inputs and routed public pages define the app; archived HTML is reference material. */
function appEntryHtmlPaths(config: string, publicFiles: readonly string[]): string[] {
  const input = config.match(/\binput:\s*\{([^}]*)\}/)?.[1];
  const built = [...(input ?? '').matchAll(/:\s*['"]\.\/([^'"]+\.html)['"]/g)].map(match => match[1]);
  assert.ok(built.length, 'Vite HTML build inputs must be available for the install metadata check');
  const copied = publicFiles.filter(name => name.endsWith('.html') && !built.includes(name)
    && siteNavigationPage('/' + name.slice(0, -5)) === name).map(name => 'public/' + name);
  return [...new Set([...built, ...copied])].sort();
}
function fixture() {
  const values = new Map<string, string>([[ACTIVE_RECORD_PREFIX_KEY, prefix], [prefix + date, JSON.stringify(record)]]);
  const storage: Storage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, raw) => { values.set(key, raw); }, removeItem: key => { values.delete(key); }, clear: () => values.clear() };
  const copies = new Map<string, DeviceRecordCopy>(), snapshots: DeviceRecordSnapshot[] = [];
  const vault: DeviceBackupVault = { async put(entry) { copies.set(entry.key, structuredClone(entry)); },
    async list(scope) { return [...copies.values()].filter(row => row.key.startsWith(scope)); },
    async preserve(snapshot) { snapshots.push(structuredClone(snapshot)); } };
  return { values, storage, copies, snapshots, vault };
}
test('capture preserves exact raw records and sync ancestors, excludes other accounts and authentication', async () => {
  const f = fixture();
  f.values.set('sb-project-auth-token', 'never-export');
  f.values.set('study-v11:user:another:2026-11-15', 'private-other-account');
  f.values.set(prefix + 'meta:calendar-token', 'never-export');
  const before = [...f.values];
  const snapshot = await captureDeviceRecords(f.storage, prefix, f.vault);
  assert.deepEqual([...f.values], before);
  assert.equal(snapshot.entries.length, 1);
  assert.equal(snapshot.entries[0].raw, JSON.stringify(record));
  assert.equal(snapshot.entries[0].hash, await deviceRecordHash(JSON.stringify(record)));
  assert.equal(f.snapshots.length, 1);
  assert.equal(f.copies.size, 1);
});
test('backup failure does not alter primary data or publish a partial capture', async () => {
  const f = fixture(), before = [...f.values];
  f.vault.preserve = async () => { throw new Error('transaction aborted'); };
  await assert.rejects(captureDeviceRecords(f.storage, prefix, f.vault));
  assert.deepEqual([...f.values], before); assert.equal(f.copies.size, 0);
});
test('empty captures retain existing recovery copies', async () => {
  const f = fixture(); await captureDeviceRecords(f.storage, prefix, f.vault);
  f.values.delete(prefix + date);
  const snapshot = await captureDeviceRecords(f.storage, prefix, f.vault);
  assert.equal(snapshot.entries.length, 0); assert.equal(f.copies.size, 1); assert.equal(f.snapshots.length, 1);
});
test('corrupt originals remain recoverable as raw text without being restored as valid records', async () => {
  const f = fixture(); f.values.set(prefix + date, '{broken');
  const snapshot = await captureDeviceRecords(f.storage, prefix, f.vault);
  f.values.delete(prefix + date);
  const result = await restoreMissingDeviceRecords(f.storage, prefix, snapshot, f.vault);
  assert.equal(result.invalid, 1); assert.equal(result.restored, 0); assert.equal(f.copies.get(prefix + date)!.raw, '{broken');
});
test('imports reject foreign scopes, duplicate keys and altered checksums before writing', async () => {
  const f = fixture(), snapshot = await captureDeviceRecords(f.storage, prefix, f.vault);
  await assert.rejects(parseDeviceSnapshot(JSON.stringify(snapshot), 'study-v11:user:other:'));
  await assert.rejects(parseDeviceSnapshot(JSON.stringify({ ...snapshot, entries: [...snapshot.entries, ...snapshot.entries] }), prefix));
  await assert.rejects(parseDeviceSnapshot(JSON.stringify({ ...snapshot, entries: [{ ...snapshot.entries[0], raw: 'altered' }] }), prefix));
  assert.equal(f.values.get(prefix + date), JSON.stringify(record));
});
test('restoration only adds missing dates and preserves both existing new content and unknown source fields', async () => {
  const f = fixture(); f.values.set(prefix + '2026-11-16', JSON.stringify({ date: '2026-11-16', items: [], notes: '舊值' }));
  const snapshot = await captureDeviceRecords(f.storage, prefix, f.vault);
  f.values.delete(prefix + date); const newer = JSON.stringify({ date: '2026-11-16', items: [], notes: '新值' });
  f.values.set(prefix + '2026-11-16', newer);
  assert.deepEqual(await restoreMissingDeviceRecords(f.storage, prefix, snapshot, f.vault), { restored: 1, skipped: 1, invalid: 0, failed: 0 });
  assert.equal(f.values.get(prefix + date), JSON.stringify(record)); assert.equal(f.values.get(prefix + '2026-11-16'), newer);
});
test('a failed pre-restore backup never replaces or adds a primary record', async () => {
  const f = fixture(), snapshot = await captureDeviceRecords(f.storage, prefix, f.vault); f.values.delete(prefix + date);
  f.vault.preserve = async () => { throw new Error('no storage'); };
  await assert.rejects(restoreMissingDeviceRecords(f.storage, prefix, snapshot, f.vault));
  assert.equal(f.values.has(prefix + date), false);
});
test('an account switch during either restore backup transaction stops before any primary write', async () => {
  for (const method of ['preserve', 'put'] as const) {
    const f = fixture(), snapshot = await captureDeviceRecords(f.storage, prefix, f.vault); f.values.delete(prefix + date);
    f.vault[method] = async () => { f.values.set(ACTIVE_RECORD_PREFIX_KEY, 'study-v11:user:new:'); };
    await assert.rejects(restoreMissingDeviceRecords(f.storage, prefix, snapshot, f.vault), /帳號已變更/);
    assert.equal(f.values.has(prefix + date), false);
  }
});
test('a file restored into an empty vault retains failed dates for a later retry', async () => {
  const source = fixture(), snapshot = await captureDeviceRecords(source.storage, prefix, source.vault);
  const receiver = fixture(); receiver.values.delete(prefix + date);
  const write = receiver.storage.setItem;
  receiver.storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  assert.equal((await restoreMissingDeviceRecords(receiver.storage, prefix, snapshot, receiver.vault)).failed, 1);
  assert.equal(receiver.copies.get(prefix + date)!.raw, JSON.stringify(record));
  receiver.storage.setItem = write;
  const retry: DeviceRecordSnapshot = { ...snapshot, entries: await receiver.vault.list(prefix) };
  assert.equal((await restoreMissingDeviceRecords(receiver.storage, prefix, retry, receiver.vault)).restored, 1);
  assert.equal(receiver.values.get(prefix + date), JSON.stringify(record));
});
test('partial quota failures are reported without losing the verified recovery source', async () => {
  const f = fixture(), snapshot = await captureDeviceRecords(f.storage, prefix, f.vault); f.values.delete(prefix + date);
  f.storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  const result = await restoreMissingDeviceRecords(f.storage, prefix, snapshot, f.vault);
  assert.equal(result.failed, 1); assert.equal(result.restored, 0); assert.equal(f.copies.size, 1);
});
test('post-backup compaction skips changed records and other accounts, retaining complete sync metadata', async () => {
  const f = fixture(), snapshot = await captureDeviceRecords(f.storage, prefix, f.vault);
  const foreign = 'study-v11:user:other:2026-11-15'; f.values.set(foreign, JSON.stringify(record));
  assert.equal(compactConfirmedRecordStorage(f.storage, new Map(snapshot.entries.map(row => [row.key, row.raw]))), 1);
  const decoded = decodeStudyRecord(f.values.get(prefix + date), date);
  assert.ok(decoded.ok); assert.deepEqual(Reflect.get(decoded.record, 'extraLegacy'), record.extraLegacy); assert.equal(Reflect.get(decoded.record, 'dirty'), true);
  assert.equal(f.values.get(foreign), JSON.stringify(record));
  f.values.set(prefix + date, JSON.stringify({ ...record, notes: 'changed' }));
  assert.equal(compactConfirmedRecordStorage(f.storage, new Map(snapshot.entries.map(row => [row.key, row.raw]))), 0);
});
test('install entry selection follows build inputs and routed public pages rather than archived HTML', () => {
  const archive = 'GSAT_Google_Calendar_Prompt_latest_2026-09-16.html';
  const config = `input: { tracker: './index.html', catalog: './material.catalog.html', siteShell: './src/site-shell.ts' }`;
  const publicFiles = ['index.html', 'gpt.prompt.html', 'privacy.html', archive, 'notes.html', 'book.png'];
  assert.deepEqual(appEntryHtmlPaths(config, publicFiles), ['index.html', 'material.catalog.html', 'public/gpt.prompt.html', 'public/privacy.html']);
  assert.ok(appEntryHtmlPaths(`input: { reference: './${archive}' }`, []).includes(archive));
  assert.throws(() => appEntryHtmlPaths('input: {}', publicFiles), /HTML build inputs/);
});

test('install metadata covers all entry pages and real icon sizes', () => {
  const root = new URL('../', import.meta.url), manifest = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.id, './'); assert.equal(manifest.scope, './');
  assert.equal(manifest.name, 'Study Tracker'); assert.equal(manifest.short_name, 'Study Tracker');
  assert.deepEqual(manifest.display_override, ['window-controls-overlay']);
  assert.equal(manifest.start_url, './index.html?source=pwa');
  const config = readFileSync(new URL('vite.config.ts', root), 'utf8');
  const entries = appEntryHtmlPaths(config, readdirSync(new URL('public/', root)));
  for (const page of entries) {
    const html = readFileSync(new URL(page, root), 'utf8');
    assert.ok(/rel="manifest" href="\.\/manifest\.webmanifest"/.test(html), `${page}: missing App manifest link`);
    assert.equal([...html.matchAll(/rel="manifest"/g)].length, 1, `${page}: expected exactly one App manifest`);
    assert.ok(!/rel="manifest"|apple-mobile-web-app-capable/.test(html.slice(html.indexOf('<body'))), `${page}: install metadata must stay in the document head`);
    assert.ok(/apple-mobile-web-app-capable/.test(html), `${page}: missing Apple web app metadata`);
  }
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL('public/' + icon.src, root)); const size = Number(icon.sizes.split('x')[0]);
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
});
