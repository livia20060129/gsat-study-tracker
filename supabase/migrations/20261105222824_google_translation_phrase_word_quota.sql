-- Permit whole-phrase debits while retaining the existing monthly limit and receipts.
alter table translation_private.google_translation_receipts
  drop constraint google_translation_receipts_words_check;
alter table translation_private.google_translation_receipts
  add constraint google_translation_receipts_words_check check (words between 1 and 200);

create or replace function public.google_translation_quota(
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
  if p_user_id is null or p_words is null or p_words < 0 or p_words > 200 then
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
