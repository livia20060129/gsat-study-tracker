const WEEK_DAYS_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0] as const;

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
