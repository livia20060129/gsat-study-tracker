export const NATIVE_AUTH_RETURN_URL = 'gsattracker://auth/callback?google_auth=1';
export const NATIVE_CALENDAR_RETURN_URL = 'gsattracker://auth/calendar';

/** Only fixed callback routes and authorization codes; never relay tokens or arbitrary URLs. */
export function nativeCallbackPage(value: string, href: string): string | null {
  try {
    if (value.length > 8192) return null;
    const source = new URL(value);
    if (source.protocol !== 'gsattracker:' || source.hostname !== 'auth' || source.username || source.password || source.port || source.hash) return null;
    const target = new URL('./index.html', href); target.search = ''; target.hash = '';
    if (source.pathname === '/calendar') {
      if (source.searchParams.get('calendar') !== 'connected' || source.searchParams.getAll('calendar').length !== 1 || [...source.searchParams.keys()].some(key => key !== 'calendar')) return null;
      target.searchParams.set('calendar', 'connected');
    } else if (source.pathname === '/callback') {
      const allowed = ['google_auth', 'code', 'error', 'error_code', 'error_description'];
      if ([...source.searchParams.keys()].some(key => !allowed.includes(key) || source.searchParams.getAll(key).length !== 1)) return null;
      if (source.searchParams.get('google_auth') !== '1') return null;
      if (!source.searchParams.get('code') && !source.searchParams.get('error') && !source.searchParams.get('error_code')) return null;
      if ([...source.searchParams.values()].some(value => value.length > 4096)) return null;
      target.search = source.search;
    } else return null;
    return target.href;
  } catch { return null; }
}

export function safeNativeFilename(value: string): string {
  const name = value.normalize('NFC').replace(/[\/\\\u0000-\u001f<>:"|?*]/g, '_').replace(/^\.+/, '').slice(0, 160).trim();
  return name || 'GSAT-Tracker-backup.json';
}

export function nativeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
