-- =============================================================
-- HTF4.0 — Replacement for enforce_meal_cap()
--
-- The original trigger used ('x' || substr(md5(...), 1, 16))::bit(64)::bigint
-- to derive advisory-lock keys. On some Postgres builds that cast
-- chain resolves to integer instead of bigint, and the call
-- pg_advisory_xact_lock(bigint, bigint) can't be found.
--
-- Fix: use hashtextextended(text, bigint) which returns bigint
-- directly, and collapse to a single-key advisory lock.
--
-- Run in: Supabase Dashboard → SQL Editor. Idempotent.
-- =============================================================

create or replace function public.enforce_meal_cap()
returns trigger
language plpgsql
as $$
declare
  existing_count int;
  lock_key bigint;
  subject_key text;
begin
  subject_key := coalesce(new.team_member_id::text, new.user_id::text)
                 || '|' || new.meal_type;
  lock_key := hashtextextended(subject_key, 0);

  -- Transaction-scoped advisory lock keyed by (subject, meal_type).
  -- Two volunteers scanning the same person at the same instant
  -- serialize here so the count/insert is race-free.
  perform pg_advisory_xact_lock(lock_key);

  if new.team_member_id is not null then
    select count(*) into existing_count
    from public.meal_records
    where team_member_id = new.team_member_id
      and meal_type = new.meal_type;
  else
    select count(*) into existing_count
    from public.meal_records
    where user_id = new.user_id
      and meal_type = new.meal_type
      and team_member_id is null;
  end if;

  if existing_count >= 2 then
    raise exception 'meal cap reached: % already had % twice',
      coalesce(new.team_member_id::text, new.user_id::text), new.meal_type
      using errcode = '23505';
  end if;

  return new;
end;
$$;

-- Trigger already exists from schema.sql; create or replace on the
-- function alone is enough. Re-bind defensively in case it was dropped.
drop trigger if exists meal_records_enforce_cap on public.meal_records;
create trigger meal_records_enforce_cap
before insert on public.meal_records
for each row execute function public.enforce_meal_cap();
