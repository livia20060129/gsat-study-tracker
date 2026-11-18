interface UpdatePreparation {
  scope(): string;
  revision(): number;
  saveDraft(): void;
  backup(prefix: string): Promise<unknown>;
  activate(): Promise<void>;
}
/** A waiting release cannot replace a page until its current draft has a verified recovery copy. */
export async function prepareAppUpdate(options: UpdatePreparation): Promise<void> {
  const prefix = options.scope();
  options.saveDraft();
  const revision = options.revision();
  await options.backup(prefix);
  if (options.scope() !== prefix) throw new Error('帳號已變更，已停止更新；請重新確認紀錄。');
  if (options.revision() !== revision) throw new Error('備份期間有新的輸入或紀錄變更，請再按一次更新。');
  await options.activate();
}
