import { initialRecordPrefix, storagePrefixForUser } from '../storage/local.ts';
import { decodeStudyRecord } from '../storage/studyRecordCodec.ts';
import { sameStudyContent } from '../storage/recordSync.ts';
import { hasProtectedStudyInput, isUnrecordedCalendarCache } from '../study/recordedActivity.ts';
import { isDeviceRecordKey, type DeviceRecordSnapshot } from '../infrastructure/storage/deviceRecordBackup.ts';
import type { KeyValueStorage } from '../infrastructure/storage/localStudyRecordRepository.ts';

export interface InstallAccount { id: string; expiresAt: number }
export interface AccountInstallReceipt { account: InstallAccount; snapshot: DeviceRecordSnapshot }
interface AccountInstallOptions {
  storage: KeyValueStorage;
  prefix: string;
  account(): Promise<InstallAccount | null>;
  cloudReady(): boolean;
  verifyDraft(): void;
  revision(): number;
  backup(prefix: string): Promise<DeviceRecordSnapshot>;
  now?(): number;
}
function accountMatches(account: InstallAccount | null, prefix: string, now: number): account is InstallAccount {
  return Boolean(account?.id && Number.isFinite(account.expiresAt) && account.expiresAt > now
    && storagePrefixForUser(account.id) === prefix);
}
function recordValues(storage: KeyValueStorage, prefix: string): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix) || !isDeviceRecordKey(key)) continue;
    const raw = storage.getItem(key);
    if (raw !== null) values.set(key, raw);
  }
  return values;
}
/** A user prefix or a green badge alone is insufficient evidence of saved cloud data. */
export function accountRecordsConfirmed(storage: KeyValueStorage, prefix: string): boolean {
  if (!prefix.startsWith('study-v11:user:') || initialRecordPrefix(storage) !== prefix) return false;
  for (const [key, raw] of recordValues(storage, prefix)) {
    const decoded = decodeStudyRecord(raw, key.slice(-10));
    if (!decoded.ok || decoded.record.storageIssue) return false;
    const record = decoded.record;
    if (isUnrecordedCalendarCache(record)) continue;
    if (record.localDirty || record.syncConflict) return false;
    if (!hasProtectedStudyInput(record)) continue;
    if (!(Number(record.serverRevision) > 0)) return false;
    if (record.syncBase) {
      const base = decodeStudyRecord(record.syncBase, record.date);
      if (!base.ok || !sameStudyContent(record, base.record)) return false;
    }
  }
  return true;
}
export function accountInstallReceiptCurrent(storage: KeyValueStorage, prefix: string, receipt: AccountInstallReceipt, now = Date.now()): boolean {
  if (!accountMatches(receipt.account, prefix, now) || receipt.snapshot.prefix !== prefix || !accountRecordsConfirmed(storage, prefix)) return false;
  const current = recordValues(storage, prefix);
  return current.size === receipt.snapshot.entries.length && receipt.snapshot.entries.every(row => current.get(row.key) === row.raw);
}
/** Verified local backup only: never starts a cloud upload, rewrites data or compacts storage. */
export async function prepareAccountInstall(options: AccountInstallOptions): Promise<AccountInstallReceipt | null> {
  const now = options.now ?? Date.now;
  const account = await options.account();
  if (!accountMatches(account, options.prefix, now()) || !options.cloudReady() || !accountRecordsConfirmed(options.storage, options.prefix)) return null;
  options.verifyDraft();
  if (!options.cloudReady() || !accountRecordsConfirmed(options.storage, options.prefix)) return null;
  const revision = options.revision();
  const snapshot = await options.backup(options.prefix);
  const latest = await options.account();
  const receipt = { account: latest ?? account, snapshot };
  if (!accountMatches(latest, options.prefix, now()) || latest.id !== account.id
    || !options.cloudReady() || options.revision() !== revision
    || !accountInstallReceiptCurrent(options.storage, options.prefix, receipt, now())) {
    throw new Error('備份期間帳號或紀錄有變更，已保留原紀錄；請確認登入與同步狀態後再安裝。');
  }
  return receipt;
}
