export interface CrossTabLockManager {
  request<T>(name: string, callback: () => Promise<T> | T): Promise<T>;
}

const inPageTails = new Map<string, Promise<void>>();

function browserLockManager(): CrossTabLockManager | null {
  if (typeof navigator === 'undefined') return null;
  const locks = (navigator as Navigator & { locks?: CrossTabLockManager }).locks;
  return locks && typeof locks.request === 'function' ? locks : null;
}

async function withInPageLock<T>(name: string, task: () => Promise<T> | T): Promise<T> {
  const previous = inPageTails.get(name) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => gate);
  inPageTails.set(name, tail);

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (inPageTails.get(name) === tail) inPageTails.delete(name);
  }
}

/**
 * Serializes one cloud-record operation across tabs when Web Locks is
 * available. The in-page fallback still protects browsers without Web Locks.
 */
export function withCrossTabLock<T>(
  name: string,
  task: () => Promise<T> | T,
  lockManager: CrossTabLockManager | null = browserLockManager(),
): Promise<T> {
  if (lockManager) return lockManager.request(name, task);
  return withInPageLock(name, task);
}
