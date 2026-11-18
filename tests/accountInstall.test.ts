import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAccountInstall, accountInstallReceiptCurrent, accountRecordsConfirmed, type InstallAccount } from '../src/application/prepareAccountInstall.ts';
import { captureDeviceRecords, type DeviceBackupVault, type DeviceRecordCopy, type DeviceRecordSnapshot } from '../src/infrastructure/storage/deviceRecordBackup.ts';
import { markRecordSynced } from '../src/storage/recordSync.ts';
import type { StudyRecord } from '../src/types.ts';

const prefix = 'study-v11:user:account-a:', date = '2026-11-18';
function fixture() {
  const record = markRecordSynced({ date, items: [], notes: '雲端已確認的筆記', serverRevision: 3 });
  const values = new Map([['study-v11:meta:active-record-prefix', prefix], [prefix + date, JSON.stringify(record)],
    ['study-v11:user:other:' + date, JSON.stringify({ date, items: [], notes: '其他帳號' })], ['sb-auth-token', 'never-export']]);
  const storage: Storage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem(key, value) { values.set(key, value); }, removeItem(key) { values.delete(key); }, clear() { values.clear(); } };
  const copies = new Map<string, DeviceRecordCopy>(), preserved: DeviceRecordSnapshot[] = [];
  const vault: DeviceBackupVault = { async put(row) { copies.set(row.key, row); }, async list(scope) { return [...copies.values()].filter(row => row.key.startsWith(scope)); }, async preserve(snapshot) { preserved.push(snapshot); } };
  let account: InstallAccount | null = { id: 'account-a', expiresAt: 5000 }, revision = 0, cloudReady = true, saves = 0, backups = 0;
  const options = { storage, prefix, async account() { return account; }, cloudReady: () => cloudReady,
    verifyDraft() { saves++; }, revision: () => revision, now: () => 1000,
    async backup(scope: string) { backups++; return captureDeviceRecords(storage, scope, vault); } };
  return { record, values, storage, copies, preserved, vault, options, saves: () => saves, backups: () => backups,
    account(value: InstallAccount | null) { account = value; }, revision() { revision++; }, busy() { cloudReady = false; } };
}
test('a signed-in confirmed account gets an exact verified backup without primary rewrites or other-account data', async () => {
  const f = fixture(), before = [...f.values];
  const receipt = await prepareAccountInstall(f.options); assert.ok(receipt);
  assert.equal(f.saves(), 1); assert.equal(f.backups(), 1); assert.deepEqual([...f.values], before);
  assert.equal(receipt.snapshot.entries.length, 1); assert.equal(f.copies.size, 1);
  assert.equal(receipt.snapshot.entries[0].raw, JSON.stringify(f.record));
  assert.equal(JSON.stringify(f.preserved).includes('never-export'), false); assert.equal(JSON.stringify(f.preserved).includes('其他帳號'), false);
  assert.equal(accountInstallReceiptCurrent(f.storage, prefix, receipt, 1000), true);
});
test('guest scopes, missing or expired sessions and mismatched accounts never start automatic preparation', async () => {
  for (const account of [null, { id: 'other', expiresAt: 5000 }, { id: 'account-a', expiresAt: 999 }]) {
    const f = fixture(); f.account(account);
    assert.equal(await prepareAccountInstall(f.options), null); assert.equal(f.saves(), 0); assert.equal(f.backups(), 0);
  }
  const f = fixture(); f.values.set('study-v11:meta:active-record-prefix', 'study-v11:guest:');
  assert.equal(await prepareAccountInstall({ ...f.options, prefix: 'study-v11:guest:' }), null);
  assert.equal(f.backups(), 0);
});
test('pending, conflicted, corrupt and unconfirmed records retain the manual backup requirement', async () => {
  for (const change of [
    (record: StudyRecord) => { record.localDirty = true; },
    (record: StudyRecord) => { record.syncConflict = true; },
    (record: StudyRecord) => { record.serverRevision = 0; },
    (record: StudyRecord) => { record.notes = '未被雲端確認的新值'; },
  ]) {
    const f = fixture(), record = structuredClone(f.record); change(record); f.values.set(prefix + date, JSON.stringify(record));
    assert.equal(await prepareAccountInstall(f.options), null); assert.equal(f.backups(), 0);
  }
  const f = fixture(); f.values.set(prefix + date, '{corrupt');
  assert.equal(await prepareAccountInstall(f.options), null); assert.equal(f.backups(), 0);
});
test('a busy cloud state or a draft that becomes dirty is not mistaken for sync success', async () => {
  const f = fixture(); f.busy(); assert.equal(await prepareAccountInstall(f.options), null); assert.equal(f.backups(), 0);
  const draft = fixture();
  assert.equal(await prepareAccountInstall({ ...draft.options, verifyDraft() {
    draft.values.set(prefix + date, JSON.stringify({ ...draft.record, localDirty: true, notes: '剛保存的草稿' }));
  } }), null);
  assert.equal(draft.backups(), 0);
});
test('untouched generated days do not block an otherwise synced account', async () => {
  const f = fixture(); f.values.set(prefix + '2026-11-19', JSON.stringify({ date: '2026-11-19', items: [], localDirty: false, serverRevision: 0 }));
  assert.equal(accountRecordsConfirmed(f.storage, prefix), true);
  const receipt = await prepareAccountInstall(f.options); assert.ok(receipt); assert.equal(receipt.snapshot.entries.length, 2);
});
test('a failed verified backup keeps installation unprepared and original data intact', async () => {
  const f = fixture(), before = [...f.values]; f.vault.preserve = async () => { throw new Error('quota'); };
  await assert.rejects(prepareAccountInstall(f.options), /quota/); assert.deepEqual([...f.values], before);
});
test('account switches, logout, cloud changes and intervening edits all invalidate asynchronous preparation', async () => {
  for (const change of ['logout', 'scope', 'busy', 'revision', 'edit', 'add', 'delete']) {
    const f = fixture();
    await assert.rejects(prepareAccountInstall({ ...f.options, async backup(scope) {
      const snapshot = await f.options.backup(scope);
      if (change === 'logout') f.account(null);
      if (change === 'scope') f.values.set('study-v11:meta:active-record-prefix', 'study-v11:user:other:');
      if (change === 'busy') f.busy();
      if (change === 'revision') f.revision();
      if (change === 'edit') f.values.set(prefix + date, JSON.stringify({ ...f.record, notes: '新值' }));
      if (change === 'add') f.values.set(prefix + '2026-11-19', JSON.stringify({ date: '2026-11-19', items: [] }));
      if (change === 'delete') f.values.delete(prefix + date);
      return snapshot;
    } }), /帳號或紀錄/);
  }
});
test('an expiring session or a silent last-moment edit prevents use of a stale install receipt', async () => {
  const f = fixture(), receipt = await prepareAccountInstall(f.options); assert.ok(receipt);
  assert.equal(accountInstallReceiptCurrent(f.storage, prefix, receipt, 5000), false);
  f.values.set(prefix + date, JSON.stringify({ ...f.record, notes: '未通知視窗的新內容' }));
  assert.equal(accountInstallReceiptCurrent(f.storage, prefix, receipt, 1000), false);
});
