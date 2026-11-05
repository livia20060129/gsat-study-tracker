import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import type { TranslationQuota } from '../supabase/functions/_shared/translationQuota.ts';

const owner = '00000000-0000-0000-0000-000000000001';
const another = '00000000-0000-0000-0000-000000000002';
let db: PGlite;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'), ('${another}');
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261105141732_google_translation_monthly_quota.sql', import.meta.url), 'utf8'));
});
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec('reset role; truncate translation_private.google_translation_usage cascade; set role service_role;');
});

async function quota(user = owner, words = 0, requestId: string | null = words ? randomUUID() : null): Promise<TranslationQuota> {
  const result = await db.query<{ quota: TranslationQuota }>('select public.google_translation_quota($1::uuid, $2::integer, $3::uuid) as quota', [user, words, requestId]);
  return result.rows[0].quota;
}
async function seedUsage(user: string, used: number, offset = 0): Promise<void> {
  await db.query(`insert into translation_private.google_translation_usage(user_id, month, used_words)
    values ($1::uuid, (translation_private.month_start(now()) + $3 * interval '1 month')::date, $2)`, [user, used, offset]);
}

test('a new account starts at 5000 words without writing or consuming a read-only balance', async () => {
  const balance = await quota();
  assert.equal(balance.unit, 'words');
  assert.equal(balance.limit, 5000);
  assert.equal(balance.used, 0);
  assert.equal(balance.remaining, 5000);
  const count = await db.query<{ count: number }>('select count(*)::int from translation_private.google_translation_usage');
  assert.equal(count.rows[0].count, 0);
});

test('the 5000th word succeeds and all competing further requests are rejected', async () => {
  await seedUsage(owner, 4999);
  const results = await Promise.all(Array.from({ length: 20 }, () => quota(owner, 1)));
  assert.equal(results.filter(result => result.allowed).length, 1);
  assert.ok(results.every(result => result.used === 5000 && result.remaining === 0));
  assert.equal((await quota(owner, 1)).allowed, false);
  assert.equal((await quota()).used, 5000);
});

test('a retry with the same server receipt cannot debit twice or be reused by another account', async () => {
  const receipt = randomUUID();
  const results = await Promise.all([quota(owner, 1, receipt), quota(owner, 1, receipt)]);
  assert.ok(results.every(result => result.allowed && result.used === 1));
  await assert.rejects(quota(another, 1, receipt), /request ID mismatch/);
  assert.equal((await quota(another)).used, 0);
});

test('registered accounts have independent balances even across fresh counter reads', async () => {
  await seedUsage(owner, 5000);
  assert.equal((await quota(owner, 1)).allowed, false);
  assert.equal((await quota(another, 1)).used, 1);
  assert.equal((await quota(owner)).used, 5000);
  assert.equal((await quota(another)).remaining, 4999);
});

test('Taipei month boundaries, year changes and leap days use the local calendar', async () => {
  const result = await db.query<{ month: string }>(`select translation_private.month_start(value)::text as month
    from unnest(array['2026-11-30T15:59:59Z','2026-11-30T16:00:00Z',
      '2026-12-31T16:00:00Z','2028-02-29T15:59:59Z','2028-02-29T16:00:00Z']::timestamptz[]) value`);
  assert.deepEqual(result.rows.map(row => row.month), ['2026-11-01', '2026-12-01', '2027-01-01', '2028-02-01', '2028-03-01']);
});

test('last month exhaustion cannot reduce this month balance and reset time is next Taipei midnight', async () => {
  await seedUsage(owner, 5000, -1);
  assert.equal((await quota()).used, 0);
  const result = await quota(owner, 1);
  assert.equal(result.remaining, 4999);
  const [year, month] = result.month.split('-').map(Number);
  assert.equal(new Date(result.resetsAt).toISOString(), new Date(Date.UTC(year, month, 1, -8)).toISOString());
});

test('a receipt retry around a month boundary remains assigned to its original month', async () => {
  await seedUsage(owner, 1, -1);
  const receipt = randomUUID();
  await db.query(`insert into translation_private.google_translation_receipts(request_id,user_id,month,words)
    values ($1::uuid,$2::uuid,(translation_private.month_start(now()) - interval '1 month')::date,1)`, [receipt, owner]);
  const retry = await quota(owner, 1, receipt);
  const current = await quota();
  assert.notEqual(retry.month, current.month);
  assert.equal(retry.used, 1);
  assert.equal(current.used, 0);
});

test('browser roles cannot invoke the counter or read and reset another account allowance', async () => {
  await quota(owner, 1);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${role};`);
    await assert.rejects(quota(owner, 1), /permission denied/);
    await assert.rejects(db.query('select * from translation_private.google_translation_usage'), /permission denied/);
    await assert.rejects(db.query('update translation_private.google_translation_usage set used_words=0'), /permission denied/);
  }
  await db.exec('reset role; set role service_role;');
  assert.equal((await quota()).used, 1);
});

test('invalid debits fail without consuming anything and receipt retention removes only this user old receipts', async () => {
  for (const words of [-1, 2, 81]) await assert.rejects(quota(owner, words), /Invalid translation quota request/);
  await assert.rejects(quota(owner, 1, null), /request ID required/);
  assert.equal((await quota()).used, 0);
  await quota(owner, 1);
  await quota(another, 1);
  await db.exec("reset role; update translation_private.google_translation_receipts set created_at=now()-interval '8 days'; set role service_role;");
  await quota(owner, 1);
  const receipts = await db.query<{ user_id: string }>('select user_id from translation_private.google_translation_receipts order by user_id');
  assert.deepEqual(receipts.rows.map(row => row.user_id), [owner, another]);
  assert.equal((await quota()).used, 2);
});
