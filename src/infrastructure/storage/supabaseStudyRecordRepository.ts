import type {
  CloudStudyRecordRepositoryPort,
  CloudStudyRecordSaveResult,
  CloudStudyRecordSnapshot,
} from '../../application/ports/studyRecordRepository.ts';
import { stripRecordSyncMeta } from '../../storage/recordSync.ts';
import { decodeStudyRecord } from '../../storage/studyRecordCodec.ts';
import type { StudyRecord } from '../../types.ts';

interface SupabaseErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface SupabaseResult<T> {
  data: T;
  error: SupabaseErrorLike | null;
}

interface StudyRecordQuery extends PromiseLike<SupabaseResult<unknown>> {
  gte(column: string, value: string): StudyRecordQuery;
  eq(column: string, value: string): StudyRecordQuery;
  order(column: string, options: { ascending: boolean }): PromiseLike<SupabaseResult<unknown>>;
  maybeSingle(): PromiseLike<SupabaseResult<unknown>>;
}

export interface SupabaseStudyRecordClient {
  from(table: string): { select(columns: string): StudyRecordQuery };
  rpc(functionName: string, parameters: Record<string, unknown>): PromiseLike<SupabaseResult<unknown>>;
}

interface StudyRecordRow {
  study_date: string;
  payload: unknown;
  revision?: number | string | null;
  updated_at?: string | null;
}

function errorMessage(error: SupabaseErrorLike): string {
  return [error.message, error.details, error.hint, error.code].filter(Boolean).join('｜') || 'Supabase request failed.';
}

function rowFrom(value: unknown): StudyRecordRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<StudyRecordRow>;
  if (!row.study_date || row.payload === undefined || row.payload === null) return null;
  return row as StudyRecordRow;
}

export function studyRecordSnapshotFromRow(value: unknown): CloudStudyRecordSnapshot | null {
  const row = rowFrom(value);
  if (!row) return null;
  const studyDate = String(row.study_date);
  const decoded = decodeStudyRecord(row.payload, studyDate);
  if (!decoded.ok) return null;
  const record = decoded.record;
  delete record.updatedAt;
  record.serverRevision = Number(row.revision || 0);
  record.serverUpdatedAt = String(row.updated_at || '');
  record.localDirty = false;
  record.syncConflict = false;
  return {
    record,
    studyDate,
    revision: record.serverRevision,
    updatedAt: record.serverUpdatedAt,
  };
}

function rowsFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Contains every study_records Data API/RPC detail used by the browser application. */
export class SupabaseStudyRecordRepository implements CloudStudyRecordRepositoryPort {
  private readonly client: SupabaseStudyRecordClient;

  constructor(client: SupabaseStudyRecordClient) {
    this.client = client;
  }

  async loadMany(updatedSince?: string | null): Promise<CloudStudyRecordSnapshot[]> {
    let query = this.client.from('study_records').select('study_date,payload,updated_at,revision');
    if (updatedSince) query = query.gte('updated_at', updatedSince);
    const result = await query.order('study_date', { ascending: true });
    if (result.error) throw new Error(errorMessage(result.error));
    return rowsFrom(result.data)
      .map(studyRecordSnapshotFromRow)
      .filter((snapshot): snapshot is CloudStudyRecordSnapshot => snapshot !== null);
  }

  async loadDate(date: string): Promise<CloudStudyRecordSnapshot | null> {
    const result = await this.client
      .from('study_records')
      .select('study_date,payload,updated_at,revision')
      .eq('study_date', date)
      .maybeSingle();
    if (result.error) throw new Error(errorMessage(result.error));
    return studyRecordSnapshotFromRow(result.data);
  }

  async loadRevision(date: string): Promise<number> {
    const result = await this.client
      .from('study_records')
      .select('study_date,payload,updated_at,revision')
      .eq('study_date', date)
      .maybeSingle();
    if (result.error) throw new Error(errorMessage(result.error));
    return studyRecordSnapshotFromRow(result.data)?.revision ?? 0;
  }

  async save(record: StudyRecord, baseRevision: number): Promise<CloudStudyRecordSaveResult> {
    const result = await this.client.rpc('upsert_study_record', {
      p_study_date: record.date,
      p_payload: stripRecordSyncMeta(record),
      p_base_revision: Number(baseRevision || 0),
    });
    if (result.error) throw new Error(errorMessage(result.error));
    const raw = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!raw || typeof raw !== 'object') throw new Error('雲端未回傳儲存結果。');
    const response = raw as Record<string, unknown>;
    const revision = Number(response.revision || 0);
    const updatedAt = String(response.updated_at || '');
    const snapshot = response.payload === undefined || response.payload === null
      ? null
      : studyRecordSnapshotFromRow({
          study_date: record.date,
          payload: response.payload,
          revision,
          updated_at: updatedAt,
        });
    return {
      applied: response.applied === true,
      record: snapshot?.record ?? null,
      revision,
      updatedAt,
    };
  }
}
