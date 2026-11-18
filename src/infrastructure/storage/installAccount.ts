import { SUPABASE_URL } from '../../config/supabase.ts';
import { browserAuthPersistence } from './browserAuthStorage.ts';
import type { InstallAccount } from '../../application/prepareAccountInstall.ts';

export const INSTALL_AUTH_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
let persistence: ReturnType<typeof browserAuthPersistence> | undefined;
/** Read the existing login without another SDK client, refresh request or legacy-session migration. */
export async function readInstallAccount(): Promise<InstallAccount | null> {
  try {
    const persisted = await (persistence ??= browserAuthPersistence(window.indexedDB)).read(INSTALL_AUTH_KEY);
    // An IndexedDB sign-out tombstone must win over a stale compatibility mirror.
    const raw = persisted === undefined ? localStorage.getItem(INSTALL_AUTH_KEY) : persisted.value;
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (typeof session?.access_token !== 'string' || !session.access_token || typeof session.user?.id !== 'string'
      || !session.user.id || !Number.isFinite(session.expires_at)) return null;
    return { id: session.user.id, expiresAt: session.expires_at * 1000 };
  } catch { return null; }
}
