import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const projectUrl = new URL('../', import.meta.url);

test('Supabase is bundled by Vite instead of loaded from a floating CDN URL', () => {
  const html = readFileSync(new URL('index.html', projectUrl), 'utf8');
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/);
  assert.match(html, /<script type="module" src="\/src\/main\.ts"><\/script>/);
});

test('Supabase dependency uses an exact version', () => {
  const packageJson = JSON.parse(readFileSync(new URL('package.json', projectUrl), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  assert.match(packageJson.dependencies?.['@supabase/supabase-js'] ?? '', /^\d+\.\d+\.\d+$/);
});

test('Edge Functions use the same exact Supabase SDK and committed Deno locks', () => {
  const shared = readFileSync(new URL('supabase/functions/_shared/googleCalendar.ts', projectUrl), 'utf8');
  assert.match(shared, /npm:@supabase\/supabase-js@2\.114\.0/);
  assert.doesNotMatch(shared, /npm:@supabase\/supabase-js@2(?:['"])/);

  for (const name of ['google-calendar', 'google-calendar-callback']) {
    const config = JSON.parse(readFileSync(new URL(`supabase/functions/${name}/deno.json`, projectUrl), 'utf8')) as {
      lock?: { frozen?: boolean };
    };
    const lock = JSON.parse(readFileSync(new URL(`supabase/functions/${name}/deno.lock`, projectUrl), 'utf8')) as {
      specifiers?: Record<string, string>;
    };
    assert.equal(config.lock?.frozen, true);
    assert.equal(lock.specifiers?.['npm:@supabase/supabase-js@2.114.0'], '2.114.0');
  }
});

test('deployment CI type-checks both Supabase Edge Function entrypoints', () => {
  const workflow = readFileSync(new URL('.github/workflows/deploy.yml', projectUrl), 'utf8');
  const packageJson = JSON.parse(readFileSync(new URL('package.json', projectUrl), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.match(workflow, /denoland\/setup-deno@v2/);
  assert.match(workflow, /deno-version:\s*v2\.9\.5/);
  assert.match(workflow, /npm run typecheck:edge/);
  assert.match(packageJson.scripts?.['typecheck:edge'] ?? '', /google-calendar\/index\.ts/);
  assert.match(packageJson.scripts?.['typecheck:edge'] ?? '', /google-calendar-callback\/index\.ts/);
  assert.match(packageJson.scripts?.['typecheck:edge'] ?? '', /--frozen/);
});

test('Calendar backend paginates database reads and bounds sync-all concurrency', () => {
  const shared = readFileSync(new URL('supabase/functions/_shared/googleCalendar.ts', projectUrl), 'utf8');
  const entrypoint = readFileSync(new URL('supabase/functions/google-calendar/index.ts', projectUrl), 'utf8');
  assert.match(shared, /collectStringKeysetPages/);
  assert.match(shared, /\.gt\('event_key', after\)/);
  assert.match(shared, /chunksOf\(stale, 200\)/);
  assert.match(entrypoint, /collectStringKeysetPages/);
  assert.match(entrypoint, /\.gt\('user_id', after\)/);
  assert.match(entrypoint, /SYNC_ALL_CONCURRENCY = 4/);
  assert.match(entrypoint, /Promise\.all/);
});

test('the first migration is a complete blank-project baseline', () => {
  const sql = readFileSync(new URL('supabase/migrations/20260817145156_create_study_records_with_rls.sql', projectUrl), 'utf8');
  const createPosition = sql.indexOf('create table if not exists public.study_records');
  assert.ok(createPosition >= 0);
  assert.match(sql, /primary key \(user_id, study_date\)/i);
  assert.match(sql, /alter table public\.study_records enable row level security/i);
  assert.match(sql, /create policy study_records_select_own/i);
  assert.match(sql, /create policy study_records_insert_own/i);
  assert.match(sql, /create policy study_records_update_own/i);
  assert.match(sql, /grant select, insert, update on table public\.study_records to authenticated/i);
});

test('local migration history is aligned with the versions already recorded in production', () => {
  const migrationNames = readdirSync(new URL('supabase/migrations/', projectUrl), { encoding: 'utf8' });
  for (const version of [
    '20260817145156_create_study_records_with_rls.sql',
    '20260824150259_calendar_hourly_sync_bridge.sql',
    '20260826195356_v171_storage_calendar.sql',
    '20260826203657_v171_revision_and_calendar_hardening.sql',
    '20260826225945_fix_study_record_revision_ambiguity.sql',
    '20260828041020_google_calendar_client_id.sql',
  ]) {
    assert.ok(migrationNames.includes(version), `missing canonical migration ${version}`);
  }
  assert.equal(migrationNames.some((name) => /^20260827000[123]_/.test(name)), false);
});

test('latest forward migration hardens concurrent initial record creation', () => {
  const migrationDirectory = new URL('supabase/migrations/', projectUrl);
  const migrationName = readdirSync(migrationDirectory, { encoding: 'utf8' })
    .find((name) => name.endsWith('_harden_sync_pagination_and_record_upsert.sql'));
  assert.ok(migrationName);
  const sql = readFileSync(new URL(migrationName, migrationDirectory), 'utf8');
  assert.match(sql, /on conflict \(user_id, study_date\) do nothing/i);
  assert.match(sql, /return query select false, v_row\.revision, v_row\.payload, v_row\.updated_at/i);
  assert.match(sql, /study_records_user_updated_date_idx/i);
  assert.match(sql, /calendar_tasks_user_calendar_key_idx/i);
});
