-- v171: revision-based study sync + server-side Google Calendar storage.

alter table public.study_records
  add column if not exists revision bigint not null default 1;

create or replace function public.upsert_study_record(
  p_study_date date,
  p_payload jsonb,
  p_base_revision bigint default null
)
returns table(
  applied boolean,
  revision bigint,
  payload jsonb,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.study_records%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select sr.* into v_row
  from public.study_records as sr
  where sr.user_id = v_uid
    and sr.study_date = p_study_date
  for update;

  if not found then
    if coalesce(p_base_revision, 0) <> 0 then
      return query select false, null::bigint, null::jsonb, null::timestamptz;
      return;
    end if;

    insert into public.study_records as sr(user_id, study_date, payload, revision, updated_at)
    values (v_uid, p_study_date, coalesce(p_payload, '{}'::jsonb), 1, now())
    returning sr.* into v_row;

    return query select true, v_row.revision, v_row.payload, v_row.updated_at;
    return;
  end if;

  if v_row.payload = coalesce(p_payload, '{}'::jsonb) then
    return query select true, v_row.revision, v_row.payload, v_row.updated_at;
    return;
  end if;

  if p_base_revision is null or p_base_revision <> v_row.revision then
    return query select false, v_row.revision, v_row.payload, v_row.updated_at;
    return;
  end if;

  update public.study_records as sr
  set payload = coalesce(p_payload, '{}'::jsonb),
      revision = sr.revision + 1,
      updated_at = now()
  where sr.user_id = v_uid
    and sr.study_date = p_study_date
  returning sr.* into v_row;

  return query select true, v_row.revision, v_row.payload, v_row.updated_at;
end;
$$;

revoke execute on function public.upsert_study_record(date, jsonb, bigint) from public, anon;
grant execute on function public.upsert_study_record(date, jsonb, bigint) to authenticated;

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calendar_id text not null default 'primary',
  client_id text,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scope text not null default 'https://www.googleapis.com/auth/calendar.readonly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz,
  sync_error text
);

alter table public.google_calendar_connections
  add column if not exists client_id text;

alter table public.google_calendar_connections enable row level security;
revoke all on table public.google_calendar_connections from anon, authenticated;

create table if not exists public.calendar_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  source_event_id text not null,
  calendar_id text not null default 'primary',
  event_date date not null,
  end_date date,
  start_at timestamptz,
  end_at timestamptz,
  is_all_day boolean not null default true,
  title text not null,
  description text not null default '',
  location text not null default '',
  category text not null default 'other',
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  event_updated_at timestamptz,
  primary key (user_id, event_key)
);

alter table public.calendar_tasks
  add column if not exists event_updated_at timestamptz;

alter table public.calendar_tasks enable row level security;
drop policy if exists "Users can read own calendar tasks" on public.calendar_tasks;
create policy "Users can read own calendar tasks"
  on public.calendar_tasks for select
  to authenticated
  using (auth.uid() = user_id);

grant select on table public.calendar_tasks to authenticated;
