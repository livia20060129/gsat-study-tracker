import { ACTIVE_RECORD_PREFIX_KEY } from '../storage/local.ts';

/** Metadata and other accounts do not change the current page's study records. */
export function isRecordStorageChange(event: Pick<StorageEvent, 'key' | 'storageArea'>, prefix: string, storage: Storage): boolean {
  if (event.storageArea && event.storageArea !== storage) return false;
  return event.key === null || event.key === ACTIVE_RECORD_PREFIX_KEY
    || Boolean(prefix && event.key.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}$/.test(event.key.slice(prefix.length)));
}

/** One refresh per burst; account changes can flush immediately to clear old content. */
export function coalescedRecordRefresh(refresh: () => void, delay = 80): {
  schedule(): void; flush(): void; cancel(): void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function cancel(): void { if (timer !== undefined) clearTimeout(timer); timer = undefined; }
  function flush(): void { cancel(); refresh(); }
  return { schedule() { cancel(); timer = setTimeout(flush, delay); }, flush, cancel };
}
