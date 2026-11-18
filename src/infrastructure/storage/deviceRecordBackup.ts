import type { KeyValueStorage } from './localStudyRecordRepository.ts';
import { decodeStudyRecord } from '../../storage/studyRecordCodec.ts';
import { initialRecordPrefix } from '../../storage/local.ts';
import { invalidateLocalRecordHistory } from './localRecordHistory.ts';

export interface DeviceRecordCopy { key: string; raw: string; hash: string; savedAt: number }
export interface DeviceRecordSnapshot { format: 'gsat-device-backup'; version: 1; prefix: string; createdAt: string; entries: DeviceRecordCopy[] }
export interface DeviceBackupVault {
  put(entry: DeviceRecordCopy): Promise<void>;
  list(prefix: string): Promise<DeviceRecordCopy[]>;
  preserve(snapshot: DeviceRecordSnapshot): Promise<void>;
}
const validPrefix = (prefix: string): boolean => /^study-v11:(?:guest|user:[^:]+):$/.test(prefix);
export const isDeviceRecordKey = (key: string): boolean => /^study-v11:(?:guest|user:[^:]+):\d{4}-\d{2}-\d{2}$/.test(key);
const BACKUP_ERROR = '裝置備份無法寫入或核對；原有紀錄仍保留，請確認網站儲存權限與可用空間。';

export async function deviceRecordHash(raw: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

/** Only study-day records enter this database. OAuth tokens and account secrets never do. */
export function browserDeviceBackupVault(factory: IDBFactory): DeviceBackupVault {
  let opening: Promise<IDBDatabase> | undefined;
  function open(): Promise<IDBDatabase> {
    if (opening) return opening;
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try { request = factory.open('gsat-study-tracker-record-backups', 1); }
      catch { reject(new Error(BACKUP_ERROR)); return; }
      let failed = false;
      const timeout = setTimeout(fail, 8000);
      function fail(): void { failed = true; clearTimeout(timeout); opening = undefined; reject(new Error(BACKUP_ERROR)); }
      request.onerror = request.onblocked = fail;
      request.onupgradeneeded = () => {
        request.result.createObjectStore('records', { keyPath: 'key' });
        request.result.createObjectStore('snapshots');
      };
      request.onsuccess = () => {
        clearTimeout(timeout);
        const database = request.result;
        if (failed) { database.close(); return; }
        database.onversionchange = () => { database.close(); opening = undefined; };
        resolve(database);
      };
    }).catch(error => { opening = undefined; throw error; });
    return opening;
  }
  async function run<T>(stores: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
    const database = await open();
    return new Promise<T>((resolve, reject) => {
      let value: T;
      const tx = database.transaction(stores, mode);
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () => reject(new Error(BACKUP_ERROR));
      try { action(tx, result => { value = result; }); }
      catch { try { tx.abort(); } catch { /* A storage failure may already have aborted this transaction. */ } reject(new Error(BACKUP_ERROR)); }
    });
  }
  async function put(entry: DeviceRecordCopy): Promise<void> {
    if (!isDeviceRecordKey(entry.key) || entry.hash !== await deviceRecordHash(entry.raw)) throw new Error(BACKUP_ERROR);
    await run<void>(['records'], 'readwrite', tx => {
      const store = tx.objectStore('records'), read = store.get(entry.key);
      read.onsuccess = () => {
        // Hashing/transactions can finish out of order. A late copy cannot replace a newer one.
        if (!read.result || read.result.savedAt <= entry.savedAt) store.put(entry);
      };
    });
  }
  async function list(prefix: string): Promise<DeviceRecordCopy[]> {
    if (!validPrefix(prefix)) throw new Error('無法確認目前帳號的資料空間。');
    const rows = await run<DeviceRecordCopy[]>(['records'], 'readonly', (tx, result) => {
      const request = tx.objectStore('records').getAll(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      request.onsuccess = () => result(request.result);
    });
    for (const row of rows) if (!isDeviceRecordKey(row.key) || row.hash !== await deviceRecordHash(row.raw)) throw new Error(BACKUP_ERROR);
    return rows;
  }
  async function preserve(snapshot: DeviceRecordSnapshot): Promise<void> {
    const content = JSON.stringify(snapshot), hash = await deviceRecordHash(content);
    await run<void>(['snapshots'], 'readwrite', tx => {
      const store = tx.objectStore('snapshots'), initial = store.get(snapshot.prefix + 'initial');
      initial.onsuccess = () => { if (!initial.result) store.put({ content, hash }, snapshot.prefix + 'initial'); };
      store.put({ content, hash }, snapshot.prefix + 'latest');
    });
    const verified = await run<{ content: string; hash: string }>(['snapshots'], 'readonly', (tx, result) => {
      const request = tx.objectStore('snapshots').get(snapshot.prefix + 'latest');
      request.onsuccess = () => result(request.result);
    });
    if (verified?.content !== content || verified.hash !== await deviceRecordHash(verified.content)) throw new Error(BACKUP_ERROR);
  }
  return { put, list, preserve };
}

let vault: DeviceBackupVault | undefined, lastCopyTime = 0;
const pending = new Set<Promise<void>>();
export function deviceBackupVault(): DeviceBackupVault {
  return vault ??= browserDeviceBackupVault(window.indexedDB);
}
/** Secondary copy only: localStorage remains the synchronous, backwards-compatible primary. */
export function queueDeviceRecordCopy(storage: KeyValueStorage, key: string, raw: string): void {
  try { if (typeof window === 'undefined' || storage !== window.localStorage || !isDeviceRecordKey(key)) return; }
  catch { return; }
  const savedAt = Math.max(performance.timeOrigin + performance.now(), lastCopyTime + 0.001);
  lastCopyTime = savedAt;
  const task = deviceRecordHash(raw).then(hash => deviceBackupVault().put({ key, raw, hash, savedAt }))
    .catch(() => { window.dispatchEvent(new Event('gsat-device-backup-unavailable')); });
  pending.add(task); void task.finally(() => pending.delete(task));
}

function assertScope(storage: KeyValueStorage, prefix: string): void {
  if (!validPrefix(prefix) || initialRecordPrefix(storage) !== prefix) throw new Error('帳號已變更，已停止處理；請重新載入後再試。');
}
export async function readDeviceRecords(storage: KeyValueStorage, prefix: string): Promise<DeviceRecordSnapshot> {
  assertScope(storage, prefix);
  const entries: DeviceRecordCopy[] = [], savedAt = performance.timeOrigin + performance.now();
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => Boolean(key?.startsWith(prefix) && isDeviceRecordKey(key)));
  for (const key of keys.sort()) {
    const raw = storage.getItem(key);
    if (raw !== null) entries.push({ key, raw, hash: await deviceRecordHash(raw), savedAt });
    assertScope(storage, prefix);
  }
  return { format: 'gsat-device-backup', version: 1, prefix, createdAt: new Date().toISOString(), entries };
}
export async function captureDeviceRecords(storage: KeyValueStorage, prefix: string, target = deviceBackupVault()): Promise<DeviceRecordSnapshot> {
  assertScope(storage, prefix);
  await Promise.all([...pending]);
  const snapshot = await readDeviceRecords(storage, prefix);
  const { entries } = snapshot;
  if (entries.length) {
    await target.preserve(snapshot);
    for (const entry of entries) await target.put(entry);
  }
  assertScope(storage, prefix);
  return snapshot;
}

export async function parseDeviceSnapshot(text: string, prefix: string): Promise<DeviceRecordSnapshot> {
  if (text.length > 32 * 1024 * 1024) throw new Error('備份檔超過 32 MB，請分批處理。');
  let value: DeviceRecordSnapshot;
  try { value = JSON.parse(text); } catch { throw new Error('無法讀取這份 JSON 備份。'); }
  if (value?.format !== 'gsat-device-backup' || value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 10000) throw new Error('這不是 GSAT Tracker 裝置備份。');
  if (!validPrefix(prefix) || value.prefix !== prefix) throw new Error('備份屬於其他帳號或訪客資料空間，請切換原帳號後再匯入。');
  const keys = new Set<string>();
  for (const entry of value.entries) {
    if (!entry || typeof entry.key !== 'string' || !entry.key.startsWith(prefix) || !isDeviceRecordKey(entry.key)
      || keys.has(entry.key) || typeof entry.raw !== 'string' || !Number.isFinite(entry.savedAt)
      || entry.hash !== await deviceRecordHash(entry.raw)) throw new Error('備份內容或核對碼不符，尚未寫入任何紀錄。');
    keys.add(entry.key);
  }
  return value;
}

export async function restoreMissingDeviceRecords(storage: KeyValueStorage, prefix: string, snapshot: DeviceRecordSnapshot, target = deviceBackupVault()): Promise<{ restored: number; skipped: number; invalid: number; failed: number }> {
  assertScope(storage, prefix);
  const checked = await parseDeviceSnapshot(JSON.stringify(snapshot), prefix);
  await target.preserve(checked);
  assertScope(storage, prefix);
  const result = { restored: 0, skipped: 0, invalid: 0, failed: 0 };
  for (const entry of checked.entries) {
    assertScope(storage, prefix);
    if (storage.getItem(entry.key) !== null) { result.skipped++; continue; }
    // Publish the recovery source before trying the smaller primary store. A quota
    // failure must leave this missing date available in the next recovery preview.
    try { await target.put(entry); } catch { result.failed++; continue; }
    assertScope(storage, prefix);
    if (storage.getItem(entry.key) !== null) { result.skipped++; continue; }
    if (!decodeStudyRecord(entry.raw, entry.key.slice(-10)).ok) { result.invalid++; continue; }
    try {
      storage.setItem(entry.key, entry.raw);
      if (storage.getItem(entry.key) !== entry.raw) throw new Error('restore verification failed');
      invalidateLocalRecordHistory(storage, entry.key);
      queueDeviceRecordCopy(storage, entry.key, entry.raw);
      result.restored++;
    } catch { result.failed++; }
  }
  if (result.restored && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-records-changed'));
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: window.localStorage }));
  }
  return result;
}
