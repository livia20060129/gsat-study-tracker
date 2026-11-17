import { overdueTasks, type OverdueTaskEntry } from './overdueTasks.ts';
import type { StudyRecord } from '../types.ts';

/** Inputs come from immutable history snapshots; filters can reuse the same day's projection. */
export function createOverdueTaskCache(calculate = overdueTasks): {
  get(records: StudyRecord[], today: string): OverdueTaskEntry[];
  invalidate(): void;
} {
  let previous: StudyRecord[] | undefined, previousDate = '', result: OverdueTaskEntry[] = [];
  return {
    get(records, today) {
      if (previous !== records || previousDate !== today) {
        result = calculate(records, today); previous = records; previousDate = today;
      }
      return result;
    },
    invalidate() { previous = undefined; },
  };
}
