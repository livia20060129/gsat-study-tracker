import assert from 'node:assert/strict';
import test from 'node:test';

import { LocalStudyRecordRepository } from '../src/infrastructure/storage/localStudyRecordRepository.ts';
import {
  studyRecordSnapshotFromRow,
  SupabaseStudyRecordRepository,
  type SupabaseStudyRecordClient,
} from '../src/infrastructure/storage/supabaseStudyRecordRepository.ts';
import type { StudyRecord } from '../src/types.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const record = (date: string): StudyRecord => ({ date, items: [], notes: `note-${date}` });

test('local repository owns scoped keys and upgrades legacy records', () => {
  const storage = new MemoryStorage();
  storage.setItem('legacy:2026-09-01', JSON.stringify({ date: 'wrong', items: [], futureField: 'kept' }));
  const repository = new LocalStudyRecordRepository(storage, 'user-a:');

  const legacy = repository.loadFromPrefix('legacy:', '2026-09-01');
  assert.equal(legacy?.date, '2026-09-01');
  assert.equal((legacy as unknown as Record<string, unknown>).futureField, 'kept');

  assert.equal(repository.save(record('2026-09-02')), true);
  assert.deepEqual(repository.listDates(), ['2026-09-02']);
  repository.setPrefix('user-b:');
  assert.equal(repository.load('2026-09-02'), null);
  assert.deepEqual(repository.listDates('user-a:'), ['2026-09-02']);
});

test('Supabase row conversion applies authoritative revision metadata', () => {
  const snapshot = studyRecordSnapshotFromRow({
    study_date: '2026-09-03',
    payload: { date: 'wrong', items: [], localDirty: true },
    revision: 7,
    updated_at: '2026-09-03T10:00:00Z',
  });
  assert.equal(snapshot?.record.date, '2026-09-03');
  assert.equal(snapshot?.record.serverRevision, 7);
  assert.equal(snapshot?.record.localDirty, false);
  assert.equal(snapshot?.record.serverUpdatedAt, '2026-09-03T10:00:00Z');
});

test('Supabase repository hides table and RPC details from callers', async () => {
  const rows = [{
    study_date: '2026-09-04',
    payload: { date: '2026-09-04', items: [] },
    revision: 2,
    updated_at: '2026-09-04T11:00:00Z',
  }];
  const calls: string[] = [];
  const query = {
    gte(column: string, value: string) { calls.push(`gte:${column}:${value}`); return this; },
    eq(column: string, value: string) { calls.push(`eq:${column}:${value}`); return this; },
    order() { calls.push('order'); return Promise.resolve({ data: rows, error: null }); },
    maybeSingle() { calls.push('single'); return Promise.resolve({ data: rows[0], error: null }); },
  };
  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      return { select: (columns: string) => { calls.push(`select:${columns}`); return query; } };
    },
    rpc(name: string, parameters: Record<string, unknown>) {
      calls.push(`rpc:${name}:${String(parameters.p_base_revision)}`);
      return Promise.resolve({ data: [{ applied: true, payload: rows[0].payload, revision: 3, updated_at: rows[0].updated_at }], error: null });
    },
  } as unknown as SupabaseStudyRecordClient;
  const repository = new SupabaseStudyRecordRepository(client);

  const loaded = await repository.loadMany('2026-09-01T00:00:00Z');
  assert.equal(loaded[0]?.record.date, '2026-09-04');
  const saved = await repository.save(record('2026-09-04'), 2);
  assert.equal(saved.applied, true);
  assert.equal(saved.revision, 3);
  assert.ok(calls.includes('from:study_records'));
  assert.ok(calls.includes('rpc:upsert_study_record:2'));
});
