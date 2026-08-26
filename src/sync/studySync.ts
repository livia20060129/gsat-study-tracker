import type { StudyRecord } from '../types';
import { decidePull, payloadForCloud } from '../storage/recordSync';

export interface StudyRecordRow {
  study_date: string;
  payload: StudyRecord;
  revision: number;
  updated_at: string;
}

export interface StudySyncStorage {
  read(date: string): StudyRecord | null;
  write(record: StudyRecord): void;
  dates(): string[];
}

export interface SupabaseLike {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  from(table: string): any;
}

export type SaveStatus = 'saved' | 'equal' | 'conflict' | 'error';

export interface SaveResult {
  status: SaveStatus;
  record?: StudyRecord;
  message?: string;
}

export interface PullSummary {
  total: number;
  accepted: number;
  pushed: number;
  conflicts: number;
  errors: number;
}

export interface PullDateResult {
  status: 'cloud' | 'equal' | 'pushed' | 'kept-local' | 'conflict' | 'missing' | 'error';
  record?: StudyRecord | null;
  message?: string;
}

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return String(error ?? 'Unknown error');
}

function cloudRecord(row: Partial<StudyRecordRow>, fallbackDate?: string): StudyRecord {
  const payload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as StudyRecord;
  return {
    ...payload,
    date: String(row.study_date ?? payload.date ?? fallbackDate ?? ''),
    serverRevision: Number(row.revision || 0) || undefined,
    serverUpdatedAt: row.updated_at ? String(row.updated_at) : undefined,
    localDirty: false,
    syncConflict: false,
  };
}

function acknowledgedRecord(local: StudyRecord, row: any): StudyRecord {
  return {
    ...local,
    serverRevision: Number(row?.revision || 0) || undefined,
    serverUpdatedAt: row?.updated_at ? String(row.updated_at) : undefined,
    localDirty: false,
    syncConflict: false,
  };
}

export class StudySyncEngine {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private loading = false;

  constructor(
    private readonly client: SupabaseLike,
    private readonly storage: StudySyncStorage,
    private readonly debounceMs = 450,
  ) {}

  get isLoading(): boolean {
    return this.loading;
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  queue(record: StudyRecord, onResult?: (result: SaveResult) => void): void {
    if (!record?.date || this.loading) return;
    const snapshot = structuredClone(record);
    const prior = this.timers.get(record.date);
    if (prior) clearTimeout(prior);
    const timer = setTimeout(async () => {
      this.timers.delete(record.date);
      const result = await this.save(snapshot);
      onResult?.(result);
    }, this.debounceMs);
    this.timers.set(record.date, timer);
  }

  async save(record: StudyRecord): Promise<SaveResult> {
    if (!record?.date) return { status: 'error', message: 'Missing study date.' };
    try {
      const baseRevision = Number(record.serverRevision || 0) || null;
      const response = await this.client.rpc('upsert_study_record', {
        p_study_date: record.date,
        p_payload: payloadForCloud(record),
        p_base_revision: baseRevision,
      });
      if (response.error) throw response.error;
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      if (!row || typeof row !== 'object') {
        return {
          status: 'error',
          message: '同步函式未回傳結果。請先套用 v171 Supabase migration。',
        };
      }
      const typedRow = row as { applied?: boolean; revision?: number; updated_at?: string; payload?: StudyRecord };
      if (!typedRow.applied) {
        const conflicted = { ...record, localDirty: true, syncConflict: true };
        this.storage.write(conflicted);
        return { status: 'conflict', record: conflicted };
      }
      const acknowledged = acknowledgedRecord(record, typedRow);
      this.storage.write(acknowledged);
      return { status: 'saved', record: acknowledged };
    } catch (error) {
      return { status: 'error', message: errorText(error) };
    }
  }

  async pullAll(): Promise<PullSummary> {
    const summary: PullSummary = { total: 0, accepted: 0, pushed: 0, conflicts: 0, errors: 0 };
    const pendingPush = new Map<string, StudyRecord>();
    const cloudDates = new Set<string>();
    this.loading = true;
    try {
      const response = await this.client
        .from('study_records')
        .select('study_date,payload,revision,updated_at')
        .order('study_date', { ascending: true });
      if (response.error) throw response.error;
      const rows = (response.data ?? []) as StudyRecordRow[];
      for (const row of rows) {
        if (!row?.study_date || !row?.payload) continue;
        summary.total += 1;
        cloudDates.add(row.study_date);
        const local = this.storage.read(row.study_date);
        const cloud = cloudRecord(row);
        const decision = decidePull(local, cloud);
        if (decision === 'use-cloud') {
          this.storage.write(cloud);
          summary.accepted += 1;
        } else if (decision === 'equal') {
          const base = local ?? cloud;
          this.storage.write({
            ...base,
            serverRevision: cloud.serverRevision,
            serverUpdatedAt: cloud.serverUpdatedAt,
            localDirty: false,
            syncConflict: false,
          });
          summary.accepted += 1;
        } else if (decision === 'push-local' && local) {
          pendingPush.set(local.date, local);
        } else if (decision === 'keep-local') {
          // No write required.
        } else {
          if (local) this.storage.write({ ...local, syncConflict: true });
          summary.conflicts += 1;
        }
      }

      for (const date of this.storage.dates()) {
        if (cloudDates.has(date)) continue;
        const local = this.storage.read(date);
        if (local) pendingPush.set(date, local);
      }
    } catch (error) {
      summary.errors += 1;
      return summary;
    } finally {
      this.loading = false;
    }

    for (const record of pendingPush.values()) {
      const result = await this.save(record);
      if (result.status === 'saved' || result.status === 'equal') summary.pushed += 1;
      else if (result.status === 'conflict') summary.conflicts += 1;
      else summary.errors += 1;
    }
    return summary;
  }

  async pullDate(date: string): Promise<PullDateResult> {
    if (!date) return { status: 'error', message: 'Missing study date.' };
    const local = this.storage.read(date);
    this.loading = true;
    let cloud: StudyRecord | null = null;
    try {
      const response = await this.client
        .from('study_records')
        .select('study_date,payload,revision,updated_at')
        .eq('study_date', date)
        .maybeSingle();
      if (response.error) throw response.error;
      if (response.data?.payload) cloud = cloudRecord(response.data as StudyRecordRow, date);
    } catch (error) {
      return { status: 'error', message: errorText(error), record: local };
    } finally {
      this.loading = false;
    }

    const decision = decidePull(local, cloud);
    if (decision === 'use-cloud' && cloud) {
      this.storage.write(cloud);
      return { status: 'cloud', record: cloud };
    }
    if (decision === 'equal') {
      if (cloud) {
        const base = local ?? cloud;
        const equal = {
          ...base,
          serverRevision: cloud.serverRevision,
          serverUpdatedAt: cloud.serverUpdatedAt,
          localDirty: false,
          syncConflict: false,
        };
        this.storage.write(equal);
        return { status: 'equal', record: equal };
      }
      return { status: 'missing', record: local };
    }
    if (decision === 'push-local' && local) {
      const saved = await this.save(local);
      if (saved.status === 'saved' || saved.status === 'equal') return { status: 'pushed', record: saved.record ?? local };
      if (saved.status === 'conflict') return { status: 'conflict', record: saved.record ?? local };
      return { status: 'error', record: local, message: saved.message };
    }
    if (decision === 'keep-local') return { status: 'kept-local', record: local };
    if (local) {
      const conflicted = { ...local, syncConflict: true };
      this.storage.write(conflicted);
      return { status: 'conflict', record: conflicted };
    }
    return { status: 'conflict', record: null };
  }
}
