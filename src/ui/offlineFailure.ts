export interface OfflineFailure { code: string; path?: string; status?: number }
export function offlineFailureMessage(failure: OfflineFailure): string {
  const file = failure.path ? `「${failure.path}」` : '離線檔案';
  switch (failure.code) {
    case 'network': return `${file}下載中斷，請連線後重試；原紀錄仍保留。`;
    case 'http': return `${file}下載失敗${failure.status ? `（HTTP ${failure.status}）` : ''}，請確認整份建置檔案已部署後重試；原紀錄仍保留。`;
    case 'payload': return `${file}的離線副本格式不符，可能被部署頁面或驗證頁取代；請確認 offline-pages 已一併部署。`;
    case 'integrity': return `${file}與此版本的核對碼不符，請確認同一份建置已完整部署；原紀錄仍保留。`;
    case 'quota': return `${file}無法寫入：網站離線快取容量不足。請先下載備份，再整理網站容量後重試。`;
    default: return `${file}無法寫入離線快取，請確認瀏覽器儲存權限後重試；原紀錄仍保留。`;
  }
}
/** Installation can die before a page receives its message; keep a small public diagnostic. */
export async function readOfflineFailure(base: string): Promise<OfflineFailure | null> {
  try {
    const cache = await caches.open(`gsat-offline:${new URL(base).pathname}:status`);
    const response = await cache.match(new URL('offline-install-status.json', base).href);
    const value = response && await response.json();
    return value?.base === base && typeof value.failure?.code === 'string' ? value.failure : null;
  } catch { return null; }
}
