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
export function initializeOfflineApp(dialog: HTMLDialogElement, options: OfflineAppOptions): { refresh(checkVersion?: boolean): void } {
  const section = document.createElement('section');
  section.setAttribute('aria-labelledby', 'siteOfflineTitle');
  const successIcon = '<svg class="site-app-success-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>';
  section.innerHTML = `<h3 id="siteOfflineTitle">離線使用與更新</h3><p data-offline-info role="status" hidden></p>
    <div class="site-app-actions"><button type="button" class="site-app-feedback-action" data-offline-prepare>${successIcon}準備離線使用</button>
    <button type="button" class="site-app-feedback-action" data-offline-check>${successIcon}檢查更新</button><button type="button" data-offline-update hidden>儲存並更新</button></div>
    <dl class="site-app-versions" aria-label="版本資訊">
      <div><dt>目前版本</dt><dd data-app-current-version></dd></div>
      <div><dt>最新版本</dt><dd data-app-latest-version aria-live="polite">尚未檢查</dd></div>
    </dl>`;
  dialog.querySelector('section')!.after(section);
  section.querySelector<HTMLElement>('[data-app-current-version]')!.textContent = `v${__STUDY_TRACKER_VERSION__}`;
  const latest = section.querySelector<HTMLElement>('[data-app-latest-version]')!;
  if (isNativeApp()) {
    section.querySelector<HTMLElement>('.site-app-actions')!.hidden = true;
    latest.textContent = '請至商店查看';
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
  let registration: ServiceWorkerRegistration | undefined;
  let pending: Promise<void> | undefined, error = '', ready = false, revision = 0, approved = false, checking = false;
  let versionPending: Promise<void> | undefined, latestVersion = '', versionChecked = false;
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
  function readLatestVersion(): Promise<void> {
    if (versionPending) return versionPending;
    if (!navigator.onLine) return Promise.resolve();
    latestVersion = ''; versionChecked = true;
    versionPending = (async () => {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(new URL('app-release.json', base), { cache: 'no-store', credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error('Release unavailable');
        const value: unknown = await response.json();
        const version = value && typeof value === 'object' && 'version' in value ? value.version : undefined;
        if (typeof version !== 'string' || version.length > 64 || !/^\d+(?:\.[\da-z-]+)+(?:\+[\da-z.-]+)?$/i.test(version)) throw new Error('Invalid release');
        latestVersion = version;
      } catch { /* A failed metadata lookup must not block offline preparation or imply the app is up to date. */ }
      finally { clearTimeout(timeout); }
    })().finally(() => { versionPending = undefined; refresh(); });
    return versionPending;
  }
  function refresh(checkVersion = false): void {
    if (checkVersion) void readLatestVersion();
    latest.textContent = !navigator.onLine ? '離線，無法確認' : versionPending ? '檢查中…'
      : latestVersion ? `v${latestVersion}` : versionChecked ? '無法確認' : '尚未檢查';
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
      : pending ? '正在下載並核對離線頁面，請保持此頁開啟…' : '');
    info.hidden = !info.textContent;
  }
  async function readActive(): Promise<void> {
    if (!registration?.active) return;
    const release = await askWorker<ReleaseInfo>(registration.active, 'GSAT_RELEASE');
    ready = release.ready;
  }
  function observe(worker: ServiceWorker): void {
    if (observed.has(worker)) return;
    observed.add(worker);
    let installed = ['installed', 'activating', 'activated'].includes(worker.state);
    worker.addEventListener('statechange', () => {
      if (['installed', 'activating', 'activated'].includes(worker.state)) installed = true;
      if (worker.state === 'activated') void readActive().then(() => refresh()).catch(() => { error = '無法確認離線版本，請再檢查更新。'; refresh(); });
      if (worker.state === 'redundant' && !installed && registration?.active) void readOfflineFailure(base).then(failure => {
        error = failure ? offlineFailureMessage(failure) : '新版未下載完整，繼續使用原版本；請連線後再檢查更新。'; refresh();
      });
      if (worker.state === 'installed' || worker.state === 'redundant') setTimeout(refresh, 0);
    });
  }
  function waitForWorker(worker: ServiceWorker, activation = false, timeoutMs = 90000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('離線下載逾時，請檢查網路後重試。')), timeoutMs);
      function finish(cause?: Error): void { clearTimeout(timeout); worker.removeEventListener('statechange', state); cause ? reject(cause) : resolve(); }
      function state(): void {
        if (worker.state === 'activated' || (!activation && worker.state === 'installed')) finish();
        else if (worker.state === 'redundant') void readOfflineFailure(base).then(failure => finish(new Error(
          failure ? offlineFailureMessage(failure) : error || '離線準備未完成，請確認網路與瀏覽器儲存權限後重試；原紀錄仍保留。')));
      }
      worker.addEventListener('statechange', state); state();
    });
  }
  async function settleInstallingWorkers(): Promise<void> {
    const seen = new Set<ServiceWorker>(), deadline = performance.now() + 90000;
    let failure: unknown;
    // A registration's automatic check may overlap the explicit update job.
    // Drain existing installs without starting another check or retrying a failed one.
    while (registration?.installing && !seen.has(registration.installing)) {
      const worker = registration.installing; seen.add(worker);
      try { await waitForWorker(worker, false, Math.max(1, deadline - performance.now())); }
      catch (cause) { failure = cause; }
    }
    if (failure) throw failure;
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
    clearSuccess(prepare); error = ''; refresh(true);
    try {
      await register();
      if (!ready && registration?.active) { await askWorker(registration.active, 'GSAT_PREPARE', 90000); await readActive(); }
      if (!ready) throw new Error('離線準備尚未完成，請連線後重試；原紀錄仍保留。');
      localStorage.setItem(ENABLED_KEY, 'true');
      showSuccess(prepare);
    } catch (cause) { error = cause instanceof Error ? cause.message : '離線準備失敗，原紀錄仍保留。'; throw cause; }
  }));
  check.addEventListener('click', () => void options.run(async () => {
    clearSuccess(check); error = ''; checking = true; refresh(true);
    try {
      if (pending) await pending;
      if (!registration) throw new Error('請先完成離線準備，再檢查更新。');
      await registration.update();
      await settleInstallingWorkers();
      await readActive();
      if (error) throw new Error(error);
      if (!ready && !registration.waiting) throw new Error('尚無已核對的離線版本，請先準備離線使用。');
      showSuccess(check);
    } catch (cause) {
      try { await settleInstallingWorkers(); } catch (latest) { cause = latest; }
      error = cause instanceof Error ? cause.message : '檢查更新失敗，請連線後再試。'; throw cause;
    }
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
  window.addEventListener('online', () => refresh(dialog.open));
  window.addEventListener('offline', () => refresh());
  refresh(); return { refresh };
}
