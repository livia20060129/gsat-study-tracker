import { prepareAppUpdate } from '../application/prepareAppUpdate.ts';
import { captureDeviceRecords } from '../infrastructure/storage/deviceRecordBackup.ts';
import { initialRecordPrefix } from '../storage/local.ts';
import { saveBeforeDeviceOperation } from './devicePreparation.ts';
import { offlineFailureMessage, readOfflineFailure } from './offlineFailure.ts';
import { isNativeApp } from '../native/platform.ts';

interface ReleaseInfo { version: string; id: string; ready: boolean }
interface OfflineAppOptions { run(task: () => Promise<void>): Promise<void>; openSettings(): void }
const ENABLED_KEY = 'study-v11:ui:offline-enabled';
const SUCCESS_FEEDBACK_MS = 5000;

function askWorker<T>(worker: ServiceWorker, type: string, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('版本確認逾時，請稍後重試。')); }, timeoutMs);
    channel.port1.onmessage = event => {
      clearTimeout(timeout); channel.port1.close();
      if (event.data?.error) reject(new Error(String(event.data.error)));
      else resolve(event.data as T);
    };
    try { worker.postMessage({ type }, [channel.port2]); }
    catch (error) { clearTimeout(timeout); channel.port1.close(); reject(error); }
  });
}
export function initializeOfflineApp(dialog: HTMLDialogElement, options: OfflineAppOptions): { refresh(): void } {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'siteOfflineTitle');
  const successIcon = '<svg class="site-app-success-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>';
  section.innerHTML = `<h3 id="siteOfflineTitle">離線使用與更新</h3><p data-offline-info role="status"></p>
    <div class="site-app-actions"><button type="button" class="site-app-feedback-action" data-offline-prepare>${successIcon}準備離線使用</button>
    <button type="button" class="site-app-feedback-action" data-offline-check>${successIcon}檢查更新</button><button type="button" data-offline-update hidden>儲存並更新</button></div>
    <p class="site-app-note">先連線準備一次，即可離線開啟主要頁面、填寫紀錄及匯出。ECDICT 僅保留最近下載的詞庫；Google 登入、翻譯與雲端同步需連線。</p>`;
  dialog.querySelector('section')!.after(section);
  if (isNativeApp()) {
    section.querySelector<HTMLElement>('[data-offline-info]')!.textContent = 'App 已內建離線頁面與詞庫；程式更新由安裝檔或商店提供。雲端同步與 Google 翻譯仍需網路。';
    section.querySelector<HTMLElement>('.site-app-actions')!.hidden = true;
    section.querySelector<HTMLElement>('.site-app-note')!.hidden = true;
    return { refresh(): void {} };
  }
  const banner = document.createElement('aside');
  banner.dataset.siteOverlay = '';
  banner.className = 'site-app-update'; banner.hidden = true; banner.setAttribute('aria-label', 'App 更新');
  banner.innerHTML = '<span role="status">新版已準備好，儲存後即可更新。</span><button type="button">查看更新</button>';
  document.body.append(banner);
  banner.querySelector('button')!.addEventListener('click', options.openSettings);
  const info = section.querySelector<HTMLElement>('[data-offline-info]')!;
  const prepare = section.querySelector<HTMLButtonElement>('[data-offline-prepare]')!;
  const check = section.querySelector<HTMLButtonElement>('[data-offline-check]')!;
  const update = section.querySelector<HTMLButtonElement>('[data-offline-update]')!;
  const supported = isSecureContext && 'serviceWorker' in navigator && import.meta.env.PROD;
  let registration: ServiceWorkerRegistration | undefined, release: ReleaseInfo | undefined;
  let pending: Promise<void> | undefined, error = '', ready = false, revision = 0, approved = false, checking = false;
  const successTimers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
  function clearSuccess(button: HTMLButtonElement): void {
    clearTimeout(successTimers.get(button)); successTimers.delete(button);
    delete button.dataset.offlineSuccess; button.removeAttribute('aria-label');
  }
  function showSuccess(button: HTMLButtonElement): void {
    clearSuccess(button);
    button.dataset.offlineSuccess = 'true';
    button.setAttribute('aria-label', `${button.textContent?.trim()}：已完成`);
    successTimers.set(button, setTimeout(() => { clearSuccess(button); refresh(); }, SUCCESS_FEEDBACK_MS));
  }
  const observed = new WeakSet<ServiceWorker>();
  const base = new URL(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href).href.replace(/manifest\.webmanifest$/, '');
  const changed = (): void => { revision++; };
  window.addEventListener('input', changed);
  window.addEventListener('study-records-changed', changed);
  window.addEventListener('storage', changed);
  function refresh(): void {
    if (error) { clearSuccess(prepare); clearSuccess(check); }
    const busy = dialog.hasAttribute('aria-busy');
    prepare.disabled = busy || !supported || !navigator.onLine;
    check.disabled = busy || !registration || !navigator.onLine;
    update.hidden = !registration?.waiting;
    update.disabled = busy || !navigator.onLine;
    banner.hidden = !registration?.waiting;
    info.dataset.error = String(Boolean(error));
    info.textContent = error || (!supported ? '此瀏覽器目前無法準備離線頁面，仍可在線上使用。'
      : !navigator.onLine ? ready ? '目前離線：可繼續查看與填寫本機紀錄。' : '目前離線；請連線後先準備離線頁面。'
      : checking ? '正在檢查並核對更新，請保持此頁開啟…'
      : registration?.waiting ? '新版已下載，請先關閉其他分頁，再選「儲存並更新」。'
      : check.dataset.offlineSuccess === 'true' ? '檢查完成，目前已是最新版本。'
      : ready ? `離線頁面已核對${release ? `（v${release.version}）` : ''}，本機紀錄可離線使用。`
      : pending ? '正在下載並核對離線頁面，請保持此頁開啟…' : '尚未準備離線頁面；首次下載約十多 MB。');
  }
  async function readActive(): Promise<void> {
    if (!registration?.active) return;
    release = await askWorker<ReleaseInfo>(registration.active, 'GSAT_RELEASE');
    ready = release.ready;
  }
  function observe(worker: ServiceWorker): void {
    if (observed.has(worker)) return;
    observed.add(worker);
    let installed = ['installed', 'activating', 'activated'].includes(worker.state);
    worker.addEventListener('statechange', () => {
      if (['installed', 'activating', 'activated'].includes(worker.state)) installed = true;
      if (worker.state === 'activated') void readActive().then(refresh).catch(() => { error = '無法確認離線版本，請再檢查更新。'; refresh(); });
      if (worker.state === 'redundant' && !installed && registration?.active) void readOfflineFailure(base).then(failure => {
        error = failure ? offlineFailureMessage(failure) : '新版未下載完整，繼續使用原版本；請連線後再檢查更新。'; refresh();
      });
      if (worker.state === 'installed' || worker.state === 'redundant') setTimeout(refresh, 0);
    });
  }
  function waitForWorker(worker: ServiceWorker, activation = false): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('離線下載逾時，請檢查網路後重試。')), 90000);
      function finish(cause?: Error): void { clearTimeout(timeout); worker.removeEventListener('statechange', state); cause ? reject(cause) : resolve(); }
      function state(): void {
        if (worker.state === 'activated' || (!activation && worker.state === 'installed')) finish();
        else if (worker.state === 'redundant') void readOfflineFailure(base).then(failure => finish(new Error(
          failure ? offlineFailureMessage(failure) : error || '離線準備未完成，請確認網路與瀏覽器儲存權限後重試；原紀錄仍保留。')));
      }
      worker.addEventListener('statechange', state); state();
    });
  }
  function register(): Promise<void> {
    if (pending) return pending;
    pending = (async () => {
      registration = await navigator.serviceWorker.register(new URL('app-worker.js', base), { scope: base, updateViaCache: 'none' });
      registration.addEventListener('updatefound', () => { if (registration?.installing) observe(registration.installing); });
      if (registration.installing) observe(registration.installing);
      await readActive();
      if (!registration.active) {
        const worker = registration.installing ?? registration.waiting;
        if (!worker) throw new Error('離線準備尚未完成，請重試。');
        await waitForWorker(worker, true);
        await readActive();
      }
    })().finally(() => { pending = undefined; refresh(); });
    refresh(); return pending;
  }
  prepare.addEventListener('click', () => void options.run(async () => {
    clearSuccess(prepare); error = ''; refresh();
    try {
      await register();
      if (!ready && registration?.active) { await askWorker(registration.active, 'GSAT_PREPARE', 90000); await readActive(); }
      if (!ready) throw new Error('離線準備尚未完成，請連線後重試；原紀錄仍保留。');
      localStorage.setItem(ENABLED_KEY, 'true');
      showSuccess(prepare);
    } catch (cause) { error = cause instanceof Error ? cause.message : '離線準備失敗，原紀錄仍保留。'; throw cause; }
  }));
  check.addEventListener('click', () => void options.run(async () => {
    clearSuccess(check); error = ''; checking = true; refresh();
    try {
      if (!registration) throw new Error('請先完成離線準備，再檢查更新。');
      await registration.update();
      if (registration.installing) await waitForWorker(registration.installing);
      await readActive();
      if (error) throw new Error(error);
      if (!ready && !registration.waiting) throw new Error('尚無已核對的離線版本，請先準備離線使用。');
      showSuccess(check);
    } catch (cause) { error = cause instanceof Error ? cause.message : '檢查更新失敗，請連線後再試。'; throw cause; }
    finally { checking = false; refresh(); }
  }));
  update.addEventListener('click', () => void options.run(async () => {
    error = '';
    const waiting = registration?.waiting;
    if (!waiting) return;
    await prepareAppUpdate({ scope: () => initialRecordPrefix(localStorage), revision: () => revision,
      saveDraft: saveBeforeDeviceOperation, backup: prefix => captureDeviceRecords(localStorage, prefix),
      activate: async () => {
        approved = true;
        try { await askWorker(waiting, 'GSAT_APPLY_UPDATE'); }
        catch (cause) { approved = false; throw cause; }
      } });
  }));
  if (supported) {
    navigator.serviceWorker.addEventListener('message', event => {
      const source = event.source as ServiceWorker | null;
      if (source?.scriptURL !== new URL('app-worker.js', base).href || event.data?.type !== 'GSAT_OFFLINE_FAILURE'
          || event.data.base !== base || typeof event.data.failure?.code !== 'string') return;
      error = offlineFailureMessage(event.data.failure); refresh();
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (approved) location.reload(); });
    try {
      if (localStorage.getItem(ENABLED_KEY) === 'true') void register().catch(() => {
        error = '無法準備新版離線頁面；原紀錄與已完成的離線版本仍保留。'; refresh();
      });
    } catch { /* Online use does not depend on the offline preference being writable. */ }
  }
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  refresh(); return { refresh };
}
