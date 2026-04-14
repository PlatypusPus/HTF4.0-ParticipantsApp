-- =============================================================
-- HTF4.0 — Meal Tracking v2
-- Allow each participant to have each meal type TWICE over the
-- whole 3-day event (not per-day). Replaces the per-day unique
-- index with a capped-count rule enforced in the app + a trigger
-- that protects against races.
-- Run AFTER meals_migration.sql in: Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. Drop the old per-day unique constraint
drop index if exists public.meal_records_unique_per_day;

-- 2. Add a trigger that caps each (user_id, meal_type) at 2 inserts
create or replace function public.enforce_meal_cap()
returns trigger
language plpgsql
as $$
declare
  existing_count int;
begin
  select count(*) into existing_count
  from public.meal_records
  where user_id = new.user_id and meal_type = new.meal_type;

  if existing_count >= 2 then
    raise exception 'meal cap reached: % already has % twice', new.user_id, new.meal_type
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists meal_records_enforce_cap on public.meal_records;
create trigger meal_records_enforce_cap
before insert on public.meal_records
for each row execute function public.enforce_meal_cap();
