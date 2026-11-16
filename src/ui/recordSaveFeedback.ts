/** Critical save failures stay visible outside the collapsible connection dock. */
export function initializeRecordSaveFeedback(root: HTMLElement): { show(message: string): void; clear(): void } {
  const message = root.querySelector<HTMLElement>('[data-save-failure-message]')!;
  function clear(): void { root.hidden = true; }
  root.querySelector<HTMLButtonElement>('[data-save-failure-close]')!.addEventListener('click', clear);
  return {
    show(text): void { message.textContent = text; root.hidden = false; },
    clear,
  };
}
