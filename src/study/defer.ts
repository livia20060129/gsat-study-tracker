import type { StudyRecord } from '../types';
import { WEEKLY_DEFER_LIMIT } from '../types';

export function countDeferred(records: StudyRecord[]): number {
  return records.reduce((total, record) => {
    return total + record.items.filter(item =>
      item.source === 'preset' &&
      item.required &&
      !item.deferredCarry &&
      item.deferred &&
      !item.done
    ).length;
  }, 0);
}

export function canDefer(records: StudyRecord[]): boolean {
  return countDeferred(records) < WEEKLY_DEFER_LIMIT;
}

export { WEEKLY_DEFER_LIMIT };
