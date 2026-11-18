export const DEVICE_DRAFT_SAVE = 'gsat-device-save-draft';
export interface DeviceDraftSaveRequest { checkOnly?: boolean; reject(message: string): void }

/** Editors keep their own validation and merge rules; installation must not bypass them. */
export function saveBeforeDeviceOperation(): void {
  requestDraftCheck(false);
}
/** Automatic backups validate editors without creating another local edit or cloud upload. */
export function verifyBeforeDeviceOperation(): void {
  requestDraftCheck(true);
}
function requestDraftCheck(checkOnly: boolean): void {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur();
  let failure = '';
  window.dispatchEvent(new CustomEvent<DeviceDraftSaveRequest>(DEVICE_DRAFT_SAVE, {
    detail: { checkOnly, reject(message) { failure ||= message; } },
  }));
  if (failure) throw new Error(failure);
}
