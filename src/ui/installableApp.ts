import { initializeOfflineApp } from './offlineApp.ts';
import { isNativeApp } from '../native/platform.ts';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function initializeInstallableApp(): void {
  const entry = document.getElementById('siteAppSettings');
  if (!entry || document.getElementById('siteAppDialog')) return;
  const installWindow = window as Window & { __gsatInstallPrompt?: InstallPrompt };
  let prompt = installWindow.__gsatInstallPrompt, busy = false, closing = false, installed = false;
  const dialog = document.createElement('dialog');
  dialog.id = 'siteAppDialog'; dialog.className = 'site-app-dialog';
  dialog.setAttribute('aria-labelledby', 'siteAppTitle');
  dialog.innerHTML = `<header><h2 id="siteAppTitle">安裝與更新</h2><button type="button" data-app-close aria-label="關閉安裝與更新">×</button></header>
    <section aria-labelledby="siteAppInstallTitle"><h3 id="siteAppInstallTitle">Study Tracker App</h3>
    <p data-app-instructions></p><button type="button" data-app-install disabled>安裝 App</button>
    <p class="site-app-note">安裝後可從裝置圖示開啟。若需跨裝置使用紀錄，請登入同一 Google 帳號。</p></section>
    <p data-app-status role="status" aria-live="polite"></p>`;
  document.body.append(dialog);
  const offline = initializeOfflineApp(dialog, { run, openSettings: () => entry.click() });
  const find = <T extends HTMLElement>(selector: string): T => dialog.querySelector<T>(selector)!;
  const install = find<HTMLButtonElement>('[data-app-install]');
  if (isNativeApp()) {
    const accountHelp = document.createElement('p'); accountHelp.className = 'site-app-note';
    const link = document.createElement('a'); link.href = 'https://myself.liviayeh.dev/support.html#account-deletion';
    link.textContent = '申請刪除帳號與資料'; accountHelp.append(link);
    find('[data-app-status]').before(accountHelp);
  }
  const standalone = (): boolean => installed || isNativeApp() || matchMedia('(display-mode: standalone)').matches
    || matchMedia('(display-mode: window-controls-overlay)').matches
    || document.documentElement.dataset.desktopTitlebar === 'true'
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  function status(message: string, error = false): void {
    const node = find('[data-app-status]'); node.textContent = message; node.dataset.error = String(error);
  }
  function installState(): void {
    if (standalone()) {
      find('[data-app-instructions]').textContent = '目前已從 App 視窗開啟。'; install.hidden = true; return;
    }
    install.disabled = busy || !prompt;
    install.hidden = !prompt;
    if (prompt) find('[data-app-instructions]').textContent = '將 Study Tracker 安裝到此裝置，之後可從圖示直接開啟。';
    else if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      find('[data-app-instructions]').textContent = '在 Safari 開啟此網站，點「分享」→「加入主畫面」，若有「以網頁 App 開啟」選項請開啟。';
    } else {
      find('[data-app-instructions]').textContent = 'Chrome／Edge：使用瀏覽器選單的「安裝應用程式」；電腦安裝後可建立桌面捷徑。Mac Safari：選「檔案」→「加入 Dock」。';
    }
  }
  async function run(task: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true; status(''); dialog.setAttribute('aria-busy', 'true');
    find<HTMLButtonElement>('[data-app-close]').disabled = true;
    dialog.querySelectorAll<HTMLButtonElement>('section button').forEach(button => { button.disabled = true; });
    try { await task(); }
    catch (error) { status(error instanceof Error ? error.message : '無法完成操作，原紀錄仍保留。', true); }
    finally {
      busy = false; dialog.removeAttribute('aria-busy');
      find<HTMLButtonElement>('[data-app-close]').disabled = false;
      dialog.querySelectorAll<HTMLButtonElement>('section button').forEach(button => { button.disabled = false; });
      installState(); offline.refresh();
    }
  }
  entry.addEventListener('click', () => {
    if (dialog.open || closing) return;
    status(''); dialog.showModal(); installState(); offline.refresh();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) dialog.animate([{ transform: 'translateY(18px)' }, { transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
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
  install.addEventListener('click', () => {
    if (!prompt || busy) return;
    const request = prompt; prompt = undefined; delete installWindow.__gsatInstallPrompt; installState();
    const failed = (): void => status('瀏覽器未完成安裝，請使用瀏覽器選單重試。', true);
    try {
      // Invoke directly in the click handler: browsers require a fresh user activation.
      void request.prompt().then(() => request.userChoice).then(choice => status(choice.outcome === 'accepted' ? '已接受安裝，之後可從裝置圖示開啟。' : '已取消安裝，網站仍可照常使用。')).catch(failed);
    } catch { failed(); }
  });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event as InstallPrompt; installState(); });
  window.addEventListener('appinstalled', () => { prompt = undefined; delete installWindow.__gsatInstallPrompt; installed = true; installState(); status('App 已安裝。'); });
}
