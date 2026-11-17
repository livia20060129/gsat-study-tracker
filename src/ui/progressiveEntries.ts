/** Presentation budget only; searches, totals and exports continue to use the complete data. */
export class ProgressiveEntries {
  private view = '';
  private limit = 0;
  private total = 0;
  private readonly batch: number;

  constructor(batch = 60) { this.batch = batch; }

  prepare(view: string, total: number, pinnedThrough = 0): number {
    if (view !== this.view) { this.view = view; this.limit = this.batch; }
    this.total = total;
    this.limit = Math.min(total, Math.max(this.limit, this.batch, pinnedThrough));
    return this.limit;
  }

  get hasMore(): boolean { return this.limit < this.total; }
  more(): boolean {
    if (!this.hasMore) return false;
    this.limit = Math.min(this.total, this.limit + this.batch);
    return true;
  }
}
