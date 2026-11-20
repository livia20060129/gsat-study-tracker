import type { StudyTimerPointer } from '../application/timer/studyTimerController.ts';
export const LOCK_TIMER_CONTROL = 'gsat-lock-timer-control';
export const RECORD_SCOPE_CHANGED = 'study-record-scope-changed';
export interface LockTimerControl { pointer: StudyTimerPointer; title: string; ended: boolean; allowPrompt: boolean }
let pending: LockTimerControl | undefined;
let reconcile = (): Promise<void> => Promise.resolve();
export function setLockTimerReconciler(callback: () => Promise<void>): void { reconcile = callback; }
export function reconcileLockTimerBeforeEdit(): Promise<void> { return import.meta.env.MODE === 'native' ? reconcile() : Promise.resolve(); }
export function takeLockTimerControl(): LockTimerControl | undefined { const value = pending; pending = undefined; return value; }
export function notifyLockTimerControl(pointer: StudyTimerPointer, title: string, ended: boolean, allowPrompt: boolean): void {
  if (import.meta.env.MODE !== 'native') return;
  pending = { pointer, title, ended, allowPrompt };
  window.dispatchEvent(new CustomEvent<LockTimerControl>(LOCK_TIMER_CONTROL, { detail: pending }));
}
