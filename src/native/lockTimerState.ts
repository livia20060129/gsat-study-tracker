import type { StudyTimerPointer } from '../application/timer/studyTimerController.ts';
import { resolveStudyTimerTarget, sameStudyTimerPointer, setStudyTimerTargetState, studyTimerTargetState } from '../application/timer/studyTimerController.ts';
import { LocalStudyRecordRepository, type KeyValueStorage } from '../infrastructure/storage/localStudyRecordRepository.ts';
import { initialRecordPrefix } from '../storage/local.ts';
import { markRecordLocallyEdited } from '../storage/recordSync.ts';
import type { StudyTimerState } from '../types.ts';

export interface LockTimerSession extends StudyTimerPointer {
  id: string; scope: string; title: string; revision: number;
  accumulatedSeconds: number; startedAt: number | null;
  baseAccumulatedSeconds: number; baseStartedAt: number | null;
}
export interface LockTimerEnvelope {
  current: LockTimerSession | null; pending: LockTimerSession[];
  available: boolean; reason?: string; applied?: boolean;
}
export const timerState = (session: LockTimerSession): StudyTimerState => ({ mode: 'timer', accumulatedSeconds: session.accumulatedSeconds, startedAt: session.startedAt });
export const timerBase = (session: LockTimerSession): StudyTimerState => ({ mode: 'timer', accumulatedSeconds: session.baseAccumulatedSeconds, startedAt: session.baseStartedAt });
export const sameTimerState = (a: StudyTimerState, b: StudyTimerState): boolean => a.mode === b.mode && a.startedAt === b.startedAt && a.accumulatedSeconds === b.accumulatedSeconds;
export function readLockTimerPointer(storage: Pick<KeyValueStorage, 'getItem'>, scope: string): StudyTimerPointer | null {
  try {
    const value = JSON.parse(storage.getItem(scope + 'active-timer') || 'null') as StudyTimerPointer | null;
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value.date) && typeof value.itemId === 'string' && value.itemId
      ? { date: value.date, itemId: value.itemId, ...(value.entryId ? { entryId: value.entryId } : {}) } : null;
  } catch { return null; }
}
/** Native actions change only their timer, after checking the current account and latest stored baseline. */
export function applyLockTimerState(storage: KeyValueStorage, session: LockTimerSession): 'applied' | 'stale' | 'other-account' | 'failed' {
  if (initialRecordPrefix(storage) !== session.scope) return 'other-account';
  const repository = new LocalStudyRecordRepository(storage, session.scope);
  const loaded = repository.loadResult(session.date);
  if (loaded.status === 'invalid') return 'failed';
  const target = resolveStudyTimerTarget(loaded.status === 'ok' ? loaded.record : null, session);
  if (!target || target.item.done || target.item.f.calendarScheduleArchived) return 'stale';
  const previous = studyTimerTargetState(target), next = timerState(session);
  if (!sameTimerState(previous, next) && !sameTimerState(previous, timerBase(session))) return 'stale';
  const pointer = readLockTimerPointer(storage, session.scope);
  if (next.startedAt !== null && pointer && !sameStudyTimerPointer(pointer, session)) return 'stale';
  if (!sameTimerState(previous, next)) {
    const base = structuredClone(target.record);
    setStudyTimerTargetState(target, next);
    if (!repository.save(markRecordLocallyEdited(target.record, base))) return 'failed';
  }
  try {
    if (next.startedAt !== null) storage.setItem(session.scope + 'active-timer', JSON.stringify({ date: session.date, itemId: session.itemId, ...(session.entryId ? { entryId: session.entryId } : {}) }));
    else if (sameStudyTimerPointer(pointer, session)) storage.removeItem(session.scope + 'active-timer');
  } catch { return 'failed'; }
  return 'applied';
}
