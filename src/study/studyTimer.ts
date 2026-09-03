import type { StudyTimerState, StudyTimeMode } from '../types.ts';

function wholeNonNegative(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

export function normalizeStudyTimerState(value: unknown): StudyTimerState {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<StudyTimerState>
    : {};
  const mode: StudyTimeMode = source.mode === 'timer' ? 'timer' : 'manual';
  const startedAt = Number(source.startedAt);
  return {
    mode,
    accumulatedSeconds: wholeNonNegative(source.accumulatedSeconds),
    startedAt: Number.isFinite(startedAt) && startedAt > 0 ? startedAt : null,
  };
}

export function studyTimerElapsedSeconds(value: unknown, now = Date.now()): number {
  const state = normalizeStudyTimerState(value);
  if (state.startedAt === null) return state.accumulatedSeconds;
  const runningSeconds = Math.max(0, Math.floor((now - state.startedAt) / 1000));
  return state.accumulatedSeconds + runningSeconds;
}

export function startStudyTimer(value: unknown, now = Date.now()): StudyTimerState {
  const state = normalizeStudyTimerState(value);
  return {
    ...state,
    mode: 'timer',
    startedAt: state.startedAt ?? now,
  };
}

export function pauseStudyTimer(value: unknown, now = Date.now()): StudyTimerState {
  const state = normalizeStudyTimerState(value);
  return {
    ...state,
    accumulatedSeconds: studyTimerElapsedSeconds(state, now),
    startedAt: null,
  };
}

export function resetStudyTimer(): StudyTimerState {
  return { mode: 'timer', accumulatedSeconds: 0, startedAt: null };
}

/** Timer display deliberately stays in minutes:seconds, including values above 59 minutes. */
export function formatStudyTimer(value: unknown, now = Date.now()): string {
  const totalSeconds = studyTimerElapsedSeconds(value, now);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Existing records store whole minutes; a non-zero timed session is at least one minute. */
export function timerMinutesValue(value: unknown, now = Date.now()): string {
  const seconds = studyTimerElapsedSeconds(value, now);
  return seconds > 0 ? String(Math.max(1, Math.round(seconds / 60))) : '';
}

/**
 * Finishes an active timed session and returns to the visible manual field.
 * A session that was actually started always fills at least one minute, even
 * when it is completed before the first whole second has elapsed.
 */
export function finishStudyTimer(
  value: unknown,
  now = Date.now(),
): { state: StudyTimerState; minutes: string } {
  const source = normalizeStudyTimerState(value);
  const wasStarted = source.startedAt !== null || source.accumulatedSeconds > 0;
  const paused = source.startedAt === null ? source : pauseStudyTimer(source, now);
  return {
    state: { ...paused, mode: 'manual' },
    minutes: wasStarted
      ? String(Math.max(1, Math.round(studyTimerElapsedSeconds(paused, now) / 60)))
      : '',
  };
}

/** Finds the current entry by stable id before writing its timer result. */
export function setTimedEntryMinutes<T extends { id?: string; minutes?: string }>(
  entries: T[],
  entryId: unknown,
  minutes: string,
): T | null {
  const id = String(entryId ?? '');
  if (!id) return null;
  const entry = entries.find(candidate => String(candidate?.id ?? '') === id) ?? null;
  if (entry) entry.minutes = minutes;
  return entry;
}
