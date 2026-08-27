export interface CompletionUnit {
  /** Counts as completed for the original item metric (done or deferred). */
  itemAccepted: boolean;
  /** Counts as actual completed workload (done only; deferred work is not done). */
  workloadCompleted: boolean;
  /** Planned minutes or another positive workload weight. */
  workload: number;
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

function percentage(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

export function summarizeCompletionUnits(
  units: CompletionUnit[],
): CompletionMetrics {
  let itemCompleted = 0;
  let workloadCompleted = 0;
  let workloadTotal = 0;

  for (const unit of units) {
    const workload = Number.isFinite(unit.workload)
      ? Math.max(0, unit.workload)
      : 0;
    if (unit.itemAccepted) itemCompleted += 1;
    workloadTotal += workload;
    if (unit.workloadCompleted) workloadCompleted += workload;
  }

  const itemTotal = units.length;
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
