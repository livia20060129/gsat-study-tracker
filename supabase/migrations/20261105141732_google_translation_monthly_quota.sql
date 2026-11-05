-- Account-wide monthly limits are committed before an external translation request.
-- These tables are private; only the verified Edge Function uses the service-role RPC.
create schema if not exists translation_private;
revoke all on schema translation_private from public, anon, authenticated;
grant usage on schema translation_private to service_role;

create table translation_private.google_translation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  used_words integer not null default 0 check (used_words between 0 and 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table translation_private.google_translation_receipts (
  request_id uuid primary key,
  user_id uuid not null,
  month date not null,
  words integer not null check (words = 1),
  created_at timestamptz not null default now(),
  foreign key (user_id, month) references translation_private.google_translation_usage(user_id, month) on delete cascade
);
create index google_translation_receipts_user_created_idx
  on translation_private.google_translation_receipts(user_id, created_at);

alter table translation_private.google_translation_usage enable row level security;
alter table translation_private.google_translation_receipts enable row level security;
revoke all on translation_private.google_translation_usage, translation_private.google_translation_receipts
  from public, anon, authenticated;
grant select, insert, update on translation_private.google_translation_usage to service_role;
grant select, insert, delete on translation_private.google_translation_receipts to service_role;

create function translation_private.month_start(p_at timestamptz)
returns date language sql immutable security invoker set search_path = ''
as $$ select date_trunc('month', p_at at time zone 'Asia/Taipei')::date; $$;
revoke all on function translation_private.month_start(timestamptz) from public, anon, authenticated;
grant execute on function translation_private.month_start(timestamptz) to service_role;

create function public.google_translation_quota(
  p_user_id uuid,
  p_words integer default 0,
  p_request_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_month date := translation_private.month_start(now());
  v_used integer := 0;
  v_allowed boolean := true;
  v_previous translation_private.google_translation_receipts%rowtype;
begin
  if p_user_id is null or p_words is null or p_words < 0 or p_words > 1 then
    raise exception 'Invalid translation quota request' using errcode = '22023';
  end if;

  if p_words > 0 then
    if p_request_id is null then
      raise exception 'Translation request ID required' using errcode = '22023';
    end if;
    -- A retry of one RPC must not debit twice, including a retry around midnight.
    perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 746146));
    select * into v_previous from translation_private.google_translation_receipts where request_id = p_request_id;
    if found then
      if v_previous.user_id <> p_user_id or v_previous.words <> p_words then
        raise exception 'Translation request ID mismatch' using errcode = '22023';
      end if;
      v_month := v_previous.month;
    else
      -- ON CONFLICT holds the row lock while evaluating the upper bound.
      insert into translation_private.google_translation_usage as usage (user_id, month, used_words)
      values (p_user_id, v_month, p_words)
      on conflict (user_id, month) do update
        set used_words = usage.used_words + excluded.used_words, updated_at = now()
        where usage.used_words + excluded.used_words <= 5000
      returning used_words into v_used;
      v_allowed := found;
      if v_allowed then
        insert into translation_private.google_translation_receipts(request_id, user_id, month, words)
        values (p_request_id, p_user_id, v_month, p_words);
        -- Receipts contain no query text and are needed only for short-lived transport retries.
        delete from translation_private.google_translation_receipts
        where user_id = p_user_id and created_at < now() - interval '7 days';
      end if;
    end if;
  end if;

  select coalesce((select used_words from translation_private.google_translation_usage
    where user_id = p_user_id and month = v_month), 0) into v_used;
  return jsonb_build_object(
    'allowed', v_allowed,
    'unit', 'words',
    'month', to_char(v_month, 'YYYY-MM'),
    'used', v_used,
    'limit', 5000,
    'remaining', 5000 - v_used,
    'resetsAt', (v_month + interval '1 month')::timestamp at time zone 'Asia/Taipei'
  );
end;
$$;

revoke all on function public.google_translation_quota(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.google_translation_quota(uuid, integer, uuid) to service_role;
comment on function public.google_translation_quota(uuid, integer, uuid) is
  'Server-only atomic 5000-word monthly allowance, keyed by verified Auth user and Asia/Taipei calendar month.';
