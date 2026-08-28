const WEEK_DAYS_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0] as const;

export const DEFERRED_TARGET_LIMIT = 3 as const;

export interface DeferredTargetCandidate {
  source?: string;
  required?: boolean;
  deferredCarry?: boolean;
  deferred?: boolean;
  done?: boolean;
  deferredTargetDay?: number;
}

export function isConfirmedDeferred(item: DeferredTargetCandidate): boolean {
  const targetDay = Number(item.deferredTargetDay);
  return item.deferred === true && (targetDay === 0 || (targetDay >= 2 && targetDay <= 6));
}

/** Returns only later days in the same Monday-to-Sunday week. */
export function futureDeferredDays(originDay: number): number[] {
  const originIndex = WEEK_DAYS_FROM_MONDAY.indexOf(
    originDay as (typeof WEEK_DAYS_FROM_MONDAY)[number]
  );

  if (originIndex < 0) return [];
  return WEEK_DAYS_FROM_MONDAY.slice(originIndex + 1);
}

export function nextDeferredDay(originDay: number): number | null {
  return futureDeferredDays(originDay)[0] ?? null;
}

export function countDeferredToDay(
  items: DeferredTargetCandidate[],
  targetDay: number,
  excludedItem?: DeferredTargetCandidate
): number {
  return items.filter(item =>
    item !== excludedItem &&
    item.source === 'preset' &&
    item.required === true &&
    !item.deferredCarry &&
    isConfirmedDeferred(item) &&
    !item.done &&
    Number(item.deferredTargetDay) === targetDay
  ).length;
}

export function hasDeferredTargetCapacity(
  items: DeferredTargetCandidate[],
  targetDay: number,
  excludedItem?: DeferredTargetCandidate
): boolean {
  return countDeferredToDay(items, targetDay, excludedItem) < DEFERRED_TARGET_LIMIT;
}

export function requiresDeferredLimitConfirmation(currentCount: number): boolean {
  return currentCount >= DEFERRED_TARGET_LIMIT;
}
