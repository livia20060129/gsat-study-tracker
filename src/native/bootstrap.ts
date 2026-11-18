import { isNativeApp, copyDeviceText } from './platform.ts';
import { nativeCallbackPage, nativeExternalUrl } from './nativePolicy.ts';
import { saveBeforeDeviceOperation } from '../ui/devicePreparation.ts';

let starting: Promise<boolean> | undefined;
export function initializeNativePlatform(): Promise<boolean> {
  if (!isNativeApp()) return Promise.resolve(true);
  return starting ??= initialize().catch(() => { alert('App 的系統功能尚未就緒，請重新開啟 App；本機紀錄仍保留。'); return true; });
}
async function initialize(): Promise<boolean> {
  const { App } = await import('@capacitor/app');
  const { Browser } = await import('@capacitor/browser');
  document.documentElement.dataset.nativeApp = 'true';
  let returning = false;
  async function callback(url: string, cold = false): Promise<boolean> {
    const destination = nativeCallbackPage(url, location.href);
    if (!destination || returning) return false;
    if (destination === location.href) return false;
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url)))].map(value => value.toString(16).padStart(2, '0')).join('');
    const key = 'gsat-native:last-launch';
    if (cold && sessionStorage.getItem(key) === digest) return false;
    try { saveBeforeDeviceOperation(); }
    catch { alert('目前輸入尚未保存，請先保存後再重新登入；原紀錄仍保留。'); return false; }
    returning = true;
    sessionStorage.setItem(key, digest);
    await Browser.close().catch(() => {});
    location.replace(destination);
    return true;
  }
  await App.addListener('appUrlOpen', event => { void callback(event.url); });
  const launch = await App.getLaunchUrl();
  if (launch?.url && await callback(launch.url, true)) return false;
  await App.addListener('backButton', ({ canGoBack }) => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    if (dialog) { if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close(); return; }
    const section = document.body.dataset.mobileSection;
    if (section && section !== 'content') {
      document.querySelector<HTMLButtonElement>('[data-mobile-section="content"]')?.click(); return;
    }
    try { saveBeforeDeviceOperation(); } catch { alert('目前輸入尚未保存，請先修正後再離開。'); return; }
    if (canGoBack) history.back(); else void App.minimizeApp();
  });
  document.addEventListener('click', event => {
    const copy = (event.target as Element | null)?.closest?.<HTMLButtonElement>('[data-copy-prompt]');
    if (copy) {
      event.preventDefault(); event.stopImmediatePropagation();
      const text = document.getElementById('prompt')?.innerText?.trim();
      if (text) void copyDeviceText(text).then(() => {
        copy.textContent = '已複製'; setTimeout(() => { copy.textContent = '複製完整 Prompt'; }, 1600);
      }).catch(() => alert('無法複製，請稍後再試。'));
      return;
    }
    const link = (event.target as Element | null)?.closest?.('a');
    if (!link || link.download || event.defaultPrevented) return;
    const url = new URL(link.href, location.href), current = new URL(location.href);
    if (url.protocol === current.protocol && url.host === current.host) {
      if (['/privacy', '/terms', '/support'].includes(url.pathname)) {
        event.preventDefault(); event.stopImmediatePropagation(); url.pathname += '.html'; location.assign(url.href);
      }
      return;
    }
    const external = nativeExternalUrl(url.href);
    if (!external) return;
    event.preventDefault(); event.stopImmediatePropagation();
    void Browser.open({ url: external }).catch(() => alert('無法開啟連結，請稍後再試。'));
  }, true);
  return true;
}
