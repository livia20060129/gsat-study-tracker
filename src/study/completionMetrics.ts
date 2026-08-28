export interface CompletionUnit {
  /** Workload-only additions do not change the original item metric. */
  itemIncluded?: boolean;
  /** Counts as completed for the original item metric (done or deferred). */
  itemAccepted: boolean;
  /** Item-metric-only detail rows do not change the workload denominator. */
  workloadIncluded?: boolean;
  /** Counts as actual completed workload (done only; deferred work is not done). */
  workloadCompleted: boolean;
}

export interface CompletionMetrics {
  itemCompleted: number;
  itemTotal: number;
  itemPercent: number;
  workloadCompleted: number;
  workloadTotal: number;
  workloadPercent: number;
  settlementPercent: number;
}

/** A makeup item adds one unit of actual workload without becoming another originally scheduled item. */
export function makeupCompletionUnit(completed: boolean): CompletionUnit {
  return {
    itemIncluded: false,
    itemAccepted: false,
    workloadCompleted: completed,
  };
}

/** One parent card may contain multiple original items; every child remains one completion unit. */
export function groupedOriginalCompletionUnits(completed: boolean[], deferred = false): CompletionUnit[] {
  return completed.map(done => ({
    itemAccepted: done || deferred,
    workloadCompleted: done,
  }));
}

/** Deferred/Calendar makeup children add workload one by one without duplicating original totals. */
export function groupedMakeupCompletionUnits(completed: boolean[]): CompletionUnit[] {
  return completed.map(makeupCompletionUnit);
}

function percentage(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

export function summarizeCompletionUnits(
  units: CompletionUnit[],
): CompletionMetrics {
  let itemCompleted = 0;
  let itemTotal = 0;
  let workloadCompleted = 0;
  let workloadTotal = 0;

  for (const unit of units) {
    if (unit.itemIncluded !== false) {
      itemTotal += 1;
      if (unit.itemAccepted) itemCompleted += 1;
    }
    if (unit.workloadIncluded !== false) {
      workloadTotal += 1;
      if (unit.workloadCompleted) workloadCompleted += 1;
    }
  }

  const itemPercent = percentage(itemCompleted, itemTotal);
  const workloadPercent = percentage(workloadCompleted, workloadTotal);

  return {
    itemCompleted,
    itemTotal,
    itemPercent,
    workloadCompleted,
    workloadTotal,
    workloadPercent,
    settlementPercent: Math.round((itemPercent + workloadPercent) / 2),
  };
}

export function formatPercentagePointDelta(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded > 0) return `+${rounded}%`;
  if (rounded < 0) return `${rounded}%`;
  return '±0%';
}
