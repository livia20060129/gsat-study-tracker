import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { initialRecordPrefix } from '../storage/local.ts';
import { LocalStudyRecordRepository } from '../infrastructure/storage/localStudyRecordRepository.ts';
import { resolveStudyTimerTarget, sameStudyTimerPointer, studyTimerTargetState } from '../application/timer/studyTimerController.ts';
import { applyLockTimerState, readLockTimerPointer, sameTimerState, timerBase, timerState, type LockTimerSession, type LockTimerEnvelope } from './lockTimerState.ts';
import { LOCK_TIMER_CONTROL, RECORD_SCOPE_CHANGED, takeLockTimerControl, type LockTimerControl } from './lockTimerEvents.ts';
import { saveBeforeDeviceOperation } from '../ui/devicePreparation.ts';

interface NativeLockTimerPlugin {
  getState(): Promise<LockTimerEnvelope>;
  publish(options: { session: LockTimerSession; expectedId: string; expectedRevision: number; allowPrompt: boolean }): Promise<LockTimerEnvelope>;
  acknowledge(options: { id: string; revision: number; accumulatedSeconds: number; startedAt: number | null; discard: boolean }): Promise<LockTimerEnvelope>;
  clear(options: { id: string; revision: number; preserve: boolean }): Promise<LockTimerEnvelope>;
  addListener(name: 'timerChanged', listener: () => void): Promise<PluginListenerHandle>;
}
const NativeTimer = registerPlugin<NativeLockTimerPlugin>('StudyLockTimer');

/** One native session, event-driven publication, and a durable native journal while WebView is suspended. */
export async function initializeLockScreenTimer(): Promise<{ sync(): Promise<void>; beforeEdit(): Promise<void>; open(url: string): Promise<boolean> }> {
  let running: Promise<void> | undefined, again = false, control = takeLockTimerControl();
  let reason = '', noticeTimer: ReturnType<typeof setTimeout> | undefined, interactiveAttempt = Boolean(control?.allowPrompt), blocked = false;
  function notice(value: string): void {
    if (value === reason) return; reason = value; clearTimeout(noticeTimer);
    const existing = document.querySelector<HTMLElement>('[data-native-timer-notice]');
    if (!value) { existing?.remove(); return; }
    const node = existing ?? document.createElement('p');
    node.dataset.nativeTimerNotice = ''; node.className = 'site-native-timer-notice'; node.setAttribute('role', 'status');
    node.textContent = value; if (!node.isConnected) document.body.append(node);
    noticeTimer = setTimeout(() => node.remove(), 5000);
  }
  async function synchronize(): Promise<void> {
    blocked = false;
    let envelope = await NativeTimer.getState();
    const scope = initialRecordPrefix(localStorage), userControl = control; control = undefined;
    if (userControl?.ended && envelope.current?.scope === scope && sameStudyTimerPointer(envelope.current, userControl.pointer)) {
      const target = resolveStudyTimerTarget(new LocalStudyRecordRepository(localStorage, scope).load(userControl.pointer.date), userControl.pointer);
      const state = target && studyTimerTargetState(target);
      if (state?.startedAt === null && state.accumulatedSeconds === 0) {
        const cleared = await NativeTimer.clear({ id: envelope.current.id, revision: envelope.current.revision, preserve: false });
        if (cleared.applied === false) { control = userControl; again = true; }
        return;
      }
    }
    for (const pending of envelope.pending ?? []) {
      if (pending.scope !== scope) continue;
      const result = applyLockTimerState(localStorage, pending);
      if (result === 'failed') { blocked = true; notice('鎖定畫面的計時尚未寫回，請稍後再開啟 App；計時仍保存在裝置。'); return; }
      if (result === 'other-account') return;
      envelope = await NativeTimer.acknowledge({ id: pending.id, revision: pending.revision, accumulatedSeconds: pending.accumulatedSeconds, startedAt: pending.startedAt, discard: result === 'stale' });
      if (result === 'applied') {
        window.dispatchEvent(new StorageEvent('storage', { key: scope + pending.date, storageArea: localStorage }));
        window.dispatchEvent(new CustomEvent('gsat-native-timer-applied', { detail: { scope, pointer: { date: pending.date, itemId: pending.itemId, entryId: pending.entryId } } }));
      }
    }
    if ((envelope.pending ?? []).some(item => item.scope === scope)) { again = true; return; }
    if (scope !== initialRecordPrefix(localStorage)) { again = true; return; }
    let current = envelope.current;
    if (current && current.scope !== scope) {
      envelope = await NativeTimer.clear({ id: current.id, revision: current.revision, preserve: true });
      if (envelope.applied === false) { again = true; return; }
      current = envelope.current;
    }
    const pointer = readLockTimerPointer(localStorage, scope) ?? current;
    const record = pointer ? new LocalStudyRecordRepository(localStorage, scope).load(pointer.date) : null;
    const target = pointer ? resolveStudyTimerTarget(record, pointer) : null;
    const state = target ? studyTimerTargetState(target) : null;
    const ended = userControl?.ended && sameStudyTimerPointer(userControl.pointer, pointer) && state?.startedAt === null && state.accumulatedSeconds === 0;
    if (!target || !state || state.mode !== 'timer' || target.item.done || target.item.f.calendarScheduleArchived || ended) {
      if (current) {
        const cleared = await NativeTimer.clear({ id: current.id, revision: current.revision, preserve: false });
        if (cleared.applied === false) again = true;
      }
      return;
    }
    const sameTarget = current?.scope === scope && sameStudyTimerPointer(current, target.pointer);
    const fields = target.item.f;
    const title = (userControl && sameStudyTimerPointer(userControl.pointer, pointer) ? userControl.title : sameTarget ? current!.title : '')
      || target.item.title || String(fields.title || fields.book || fields.topic || '讀書計時');
    const session: LockTimerSession = { ...target.pointer, id: sameTarget ? current!.id : crypto.randomUUID(), scope,
      title: title.slice(0, 160), revision: current?.revision ?? 0,
      accumulatedSeconds: state.accumulatedSeconds, startedAt: state.startedAt,
      baseAccumulatedSeconds: state.accumulatedSeconds, baseStartedAt: state.startedAt };
    if (sameTarget && current && current.title === session.title && sameTimerState(timerState(current), state)
      && sameTimerState(timerBase(current), state) && envelope.available && !userControl) return;
    const published = await NativeTimer.publish({ session, expectedId: current?.id ?? '', expectedRevision: current?.revision ?? 0, allowPrompt: Boolean(userControl?.allowPrompt) });
    if (published.applied === false) { again = true; return; }
    if (!published.available && userControl) notice(published.reason === 'notifications-denied'
      ? '請允許 App 通知，才能顯示鎖定畫面計時；App 內計時仍保留。'
      : '系統目前無法顯示鎖定畫面計時，請確認已允許即時動態；App 內計時仍保留。');
    else if (published.available) notice('');
  }
  function sync(): Promise<void> {
    again = true;
    if (running) return running;
    running = (async () => {
      for (let pass = 0; again && pass < 8; pass++) { again = false; await synchronize(); }
    })().catch(() => {
      blocked = true;
      if (interactiveAttempt) notice('此 App 的鎖定畫面計時尚未就緒，請更新安裝檔；原有計時仍保留。');
      again = false;
    }).finally(() => { running = undefined; interactiveAttempt = false; if (again) setTimeout(() => void sync(), 100); });
    return running;
  }
  window.addEventListener(LOCK_TIMER_CONTROL, event => { control = takeLockTimerControl() ?? (event as CustomEvent<LockTimerControl>).detail; interactiveAttempt ||= control.allowPrompt; void sync(); });
  for (const event of ['study-records-changed', RECORD_SCOPE_CHANGED, 'storage', 'focus']) window.addEventListener(event, () => void sync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void sync(); });
  await NativeTimer.addListener('timerChanged', () => void sync()).catch(() => {});
  await sync();
  return { sync, async beforeEdit() {
    await sync();
    if (blocked || again) throw new Error('鎖定畫面的計時尚未確認，請稍後再試；原有計時仍保留。');
  }, async open(value) {
    const url = new URL(value);
    if (url.protocol !== 'gsattracker:' || url.host !== 'timer') return false;
    await sync();
    const current = (await NativeTimer.getState()).current;
    if (!current || current.id !== url.searchParams.get('sessionId') || current.scope !== initialRecordPrefix(localStorage)) return false;
    const destination = new URL('index.html', location.href); destination.searchParams.set('date', current.date);
    if (location.href === destination.href) return false;
    saveBeforeDeviceOperation(); location.replace(destination.href); return true;
  } };
}
