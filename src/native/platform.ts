import { Capacitor } from '@capacitor/core';
import { SUPABASE_URL } from '../config/supabase.ts';

export function isNativeApp(): boolean {
  return import.meta.env.MODE === 'native' && Capacitor.isNativePlatform();
}

export async function openAuthorizationUrl(value: string): Promise<void> {
  const url = new URL(value);
  const valid = url.protocol === 'https:' && !url.username && !url.password
    && (url.origin === SUPABASE_URL && url.pathname === '/auth/v1/authorize'
      || url.origin === 'https://accounts.google.com' && ['/o/oauth2/auth', '/o/oauth2/v2/auth'].includes(url.pathname));
  if (!valid) throw new Error('無法開啟未確認的授權網址。');
  if (isNativeApp()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: url.href });
  } else window.location.assign(url.href);
}

export async function copyDeviceText(value: string): Promise<void> {
  if (isNativeApp()) {
    const { Clipboard } = await import('@capacitor/clipboard');
    await Clipboard.write({ string: value });
  } else await navigator.clipboard.writeText(value);
}
