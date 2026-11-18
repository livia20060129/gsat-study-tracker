import { initialRecordPrefix } from '../storage/local.ts';
import { captureDeviceRecords, deviceBackupVault, isDeviceRecordKey, parseDeviceSnapshot, readDeviceRecords, restoreMissingDeviceRecords,
  type DeviceRecordSnapshot } from '../infrastructure/storage/deviceRecordBackup.ts';
import { compactConfirmedRecordStorage } from '../infrastructure/storage/localRecordCompaction.ts';
import { saveBeforeDeviceOperation } from './devicePreparation.ts';
import { decodeStudyRecord } from '../storage/studyRecordCodec.ts';
import { initializeOfflineApp } from './offlineApp.ts';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function initializeInstallableApp(): void {
  const entry = document.getElementById('siteAppSettings');
  if (!entry || document.getElementById('siteAppDialog')) return;
  const installWindow = window as Window & { __gsatInstallPrompt?: InstallPrompt };
  let prompt = installWindow.__gsatInstallPrompt, busy = false, prepared = false, scope = '', closing = false, localCount = 0, revision = 0;
  let recovery: DeviceRecordSnapshot | null = null;
  const dialog = document.createElement('dialog');
  dialog.id = 'siteAppDialog'; dialog.className = 'site-app-dialog';
  dialog.setAttribute('aria-labelledby', 'siteAppTitle');
  dialog.innerHTML = `<header><h2 id="siteAppTitle">安裝與裝置資料</h2><button type="button" data-app-close aria-label="關閉安裝與資料">×</button></header>
    <section aria-labelledby="siteAppInstallTitle"><h3 id="siteAppInstallTitle">GSAT Tracker App</h3>
    <p data-app-instructions></p><button type="button" data-app-install disabled>安裝 App</button>
    <p class="site-app-note">安裝前請先備份。若新 App 沒有原瀏覽器的資料，請登入同一 Google 帳號；訪客可先下載備份，再於新 App 匯入。</p></section>
    <section aria-labelledby="siteAppDataTitle"><h3 id="siteAppDataTitle">裝置備份與容量</h3>
    <p data-app-source></p><p data-app-capacity></p><p data-app-persistence></p>
    <div class="site-app-actions"><button type="button" data-app-backup><span data-ui-icon="save" aria-hidden="true"></span>備份並整理</button>
    <button type="button" data-app-export><span data-ui-icon="download" aria-hidden="true"></span>下載備份</button>
    <button type="button" data-app-import>匯入備份</button><input type="file" data-app-file accept=".json,application/json" hidden>
    <button type="button" data-app-persist>保留裝置資料</button></div>
    <p data-app-backup-info></p><details data-app-recovery hidden><summary>還原缺少的日期</summary><p data-app-missing></p>
    <button type="button" data-app-restore>確認還原缺少紀錄</button><p class="site-app-note">現有日期保留。若需處理已有日期，可將下載備份貼到首頁「匯入進度」預覽確認。</p></details>
    <p class="site-app-note">裝置備份不包含登入憑證。Google 翻譯、Calendar 與雲端同步需要網路。完成離線準備後，可離線開啟及重新載入主要頁面。</p></section>
    <p data-app-status role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const offline = initializeOfflineApp(dialog, { run, openSettings: () => entry.click() });
  const find = <T extends HTMLElement>(selector: string): T => dialog.querySelector<T>(selector)!;
  const install = find<HTMLButtonElement>('[data-app-install]');
  const standalone = (): boolean => matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  function status(message: string, error = false): void {
    const node = find('[data-app-status]'); node.textContent = message; node.dataset.error = String(error);
  }
  function installState(): void {
    if (standalone()) {
      find('[data-app-instructions]').textContent = '目前已從 App 視窗開啟。'; install.hidden = true; return;
    }
    install.hidden = false;
    install.disabled = busy || !prompt || !prepared;
    if (prompt) find('[data-app-instructions]').textContent = '完成「備份並整理」後，即可安裝到此裝置。';
    else if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      find('[data-app-instructions]').textContent = '在 Safari 開啟此網站，點「分享」→「加入主畫面」，若有「以網頁 App 開啟」選項請開啟。';
      install.hidden = true;
    } else {
      find('[data-app-instructions]').textContent = 'Chrome／Edge：使用瀏覽器選單的「安裝應用程式」；電腦安裝後可建立桌面捷徑。Mac Safari：選「檔案」→「加入 Dock」。';
      install.hidden = true;
    }
  }
  function assertScope(): void {
    if (scope !== initialRecordPrefix(localStorage)) throw new Error('帳號已變更，請關閉後重新開啟此視窗。');
  }
  async function refresh(): Promise<void> {
    const prefix = scope;
    let count = 0, characters = 0;
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)!;
      const value = localStorage.getItem(key) ?? '';
      characters += (key.length + value.length) * 2;
      if (key.startsWith(prefix) && isDeviceRecordKey(key)) count++;
    }
    localCount = count;
    find('[data-app-source]').textContent = `${prefix.includes(':guest:') ? '訪客' : '目前帳號'}｜本機 ${count} 天紀錄`;
    find('[data-app-capacity]').textContent = `紀錄儲存區約 ${(characters / 1048576).toFixed(2)} MB（估計值）`;
    const estimate = await navigator.storage?.estimate?.().catch(() => null);
    if (estimate?.quota) find('[data-app-capacity]').textContent += `；網站總用量約 ${((estimate.usage ?? 0) / 1048576).toFixed(1)} MB／配額約 ${(estimate.quota / 1048576).toFixed(0)} MB`;
    const persistent = await navigator.storage?.persisted?.().catch(() => false);
    find('[data-app-persistence]').textContent = persistent ? '已取得持續儲存保護。仍建議另外下載備份。' : '可申請保留裝置資料，是否允許由瀏覽器決定；不會增加紀錄儲存區的容量。';
    const entries = await deviceBackupVault().list(prefix);
    assertScope();
    recovery = { format: 'gsat-device-backup', version: 1, prefix, createdAt: new Date().toISOString(), entries };
    find('[data-app-backup-info]').textContent = entries.length ? `已核對裝置備份 ${entries.length} 天；最近保存 ${new Date(Math.max(...entries.map(row => row.savedAt))).toLocaleString('zh-TW')}。` : '尚無裝置備份，請先選「備份並整理」。';
    showRecovery(recovery);
    find<HTMLButtonElement>('[data-app-export]').disabled = !entries.length && !localCount;
  }
  function showRecovery(snapshot: DeviceRecordSnapshot): void {
    const missing = snapshot.entries.filter(row => localStorage.getItem(row.key) === null);
    find<HTMLDetailsElement>('[data-app-recovery]').hidden = !missing.length;
    find('[data-app-missing]').textContent = `共 ${missing.length} 天：${missing.map(row => row.key.slice(-10)).join('、')}`;
  }
  async function run(task: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true; dialog.setAttribute('aria-busy', 'true');
    find<HTMLButtonElement>('[data-app-close]').disabled = true;
    dialog.querySelectorAll<HTMLButtonElement>('section button').forEach(button => { button.disabled = true; });
    try { assertScope(); await task(); assertScope(); }
    catch (error) { status(error instanceof Error ? error.message : '無法完成操作，原紀錄仍保留。', true); }
    finally {
      busy = false; dialog.removeAttribute('aria-busy');
      find<HTMLButtonElement>('[data-app-close]').disabled = false;
      dialog.querySelectorAll<HTMLButtonElement>('section button').forEach(button => { button.disabled = false; });
      find<HTMLButtonElement>('[data-app-export]').disabled = !recovery?.entries.length && !localCount;
      installState();
      offline.refresh();
    }
  }
  function download(snapshot: DeviceRecordSnapshot): void {
    const records = snapshot.entries.flatMap(row => {
      const decoded = decodeStudyRecord(row.raw, row.key.slice(-10)); return decoded.ok ? [decoded.record] : [];
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...snapshot, records }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `GSAT-Tracker-${snapshot.prefix.includes(':guest:') ? 'guest' : 'account'}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  entry.addEventListener('click', () => {
    scope = initialRecordPrefix(localStorage); prepared = false; recovery = null;
    status('正在讀取裝置資料…'); dialog.showModal(); installState();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) dialog.animate([{ transform: 'translateY(18px)' }, { transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
    void run(async () => { await refresh(); status(''); });
  });
  function close(): void {
    if (busy || closing) return;
    closing = true;
    const finish = (): void => { dialog.close(); closing = false; };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else void dialog.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(18px)' }], { duration: 150, easing: 'ease-in' }).finished.then(finish, finish);
  }
  find('[data-app-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  find('[data-app-backup]').addEventListener('click', () => void run(async () => {
    assertScope(); status('正在保存並核對裝置備份…');
    // Preserve stored originals first. This can free space before a full store retries its draft.
    const captured = await captureDeviceRecords(localStorage, scope); assertScope();
    const compacted = compactConfirmedRecordStorage(localStorage, new Map(captured.entries.map(row => [row.key, row.raw])));
    saveBeforeDeviceOperation(); assertScope();
    const capturedRevision = revision;
    await captureDeviceRecords(localStorage, scope); assertScope();
    if (capturedRevision !== revision) throw new Error('備份期間紀錄有更新，請再選一次「備份並整理」。');
    prepared = true; await refresh(); status(`裝置備份已完成核對，已無損整理 ${compacted} 筆資料。`);
  }));
  install.addEventListener('click', () => {
    if (!prompt || busy || !prepared) return;
    try { assertScope(); }
    catch (error) { status((error as Error).message, true); prepared = false; installState(); return; }
    const request = prompt; prompt = undefined; delete installWindow.__gsatInstallPrompt; installState();
    // Invoke directly in the click handler: browsers require a fresh user activation.
    void request.prompt().then(() => request.userChoice).then(choice => status(choice.outcome === 'accepted' ? '已接受安裝，之後可從裝置圖示開啟。' : '已取消安裝，網站仍可照常使用。'))
      .catch(() => status('瀏覽器未完成安裝，請使用瀏覽器選單重試。', true));
  });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event as InstallPrompt; installState(); });
  window.addEventListener('appinstalled', () => { prompt = undefined; install.hidden = true; status('App 已安裝。'); });
  find('[data-app-export]').addEventListener('click', () => void run(async () => {
    const current = await readDeviceRecords(localStorage, scope); assertScope();
    const entries = new Map((recovery?.entries ?? []).map(row => [row.key, row]));
    for (const row of current.entries) entries.set(row.key, row);
    download({ ...current, entries: [...entries.values()].sort((a, b) => a.key.localeCompare(b.key)) });
    status('已下載已儲存的紀錄備份；尚未儲存的輸入請先保存。');
  }));
  find('[data-app-import]').addEventListener('click', () => find<HTMLInputElement>('[data-app-file]').click());
  find<HTMLInputElement>('[data-app-file]').addEventListener('change', event => void run(async () => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
    if (file.size > 32 * 1024 * 1024) throw new Error('備份檔超過 32 MB，請分批處理。');
    recovery = await parseDeviceSnapshot(await file.text(), scope); assertScope(); showRecovery(recovery); input.value = '';
    status('備份已核對。請展開「還原缺少的日期」，確認後再還原。');
  }));
  find('[data-app-restore]').addEventListener('click', () => void run(async () => {
    if (!recovery) return; saveBeforeDeviceOperation();
    const result = await restoreMissingDeviceRecords(localStorage, scope, recovery);
    prepared = false; await refresh();
    status(`已還原 ${result.restored} 天；保留現有 ${result.skipped} 天。${result.invalid ? ` ${result.invalid} 天原文無法解碼，備份仍保留。` : ''}${result.failed ? ` ${result.failed} 天未寫入，請整理空間後重試。` : ''}`, Boolean(result.failed || result.invalid));
  }));
  find('[data-app-persist]').addEventListener('click', () => void run(async () => {
    const granted = await navigator.storage?.persist?.(); await refresh();
    status(granted ? '瀏覽器已允許持續儲存保護。' : '瀏覽器目前未授予持續儲存保護；仍可使用網站及下載備份。');
  }));
  window.addEventListener('storage', event => {
    if (dialog.open && (event.key === null || event.key === 'study-v11:meta:active-record-prefix')) {
      prepared = false; recovery = null; installState(); status('資料空間已變更，請關閉後重新開啟。', true);
      if (initialRecordPrefix(localStorage) !== scope) {
        localCount = 0;
        find('[data-app-source]').textContent = '帳號已變更，請重新開啟。';
        find('[data-app-backup-info]').textContent = '';
        find('[data-app-missing]').textContent = '';
        find<HTMLDetailsElement>('[data-app-recovery]').hidden = true;
      }
    } else if (dialog.open && event.key?.startsWith(scope) && isDeviceRecordKey(event.key)) {
      invalidatePreparedCopy();
    }
  });
  function invalidatePreparedCopy(): void {
    revision++;
    if (dialog.open && prepared && !busy) {
      prepared = false; installState(); status('紀錄已更新，請重新完成「備份並整理」後安裝。');
    }
  }
  window.addEventListener('study-records-changed', invalidatePreparedCopy);
}
