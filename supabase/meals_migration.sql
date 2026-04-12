-- =============================================================
-- HTF4.0 — Meal Tracking Migration
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================

-- =============================================================
-- MEAL RECORDS
-- One row per (participant, meal_type, date). Volunteers scan
-- NFC stickers to record that a participant received a meal.
-- =============================================================
create table if not exists public.meal_records (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade not null,
  meal_type  text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  served_by  uuid references public.profiles(id) on delete set null,
  served_at  timestamptz not null default now(),
  meal_date  date not null default (now() at time zone 'utc')::date
);

-- Prevent double-feeding: one meal of each type per participant per day
create unique index if not exists meal_records_unique_per_day
  on public.meal_records (user_id, meal_type, meal_date);

create index if not exists meal_records_served_at_idx
  on public.meal_records (served_at desc);

-- Realtime so the volunteer UI updates live across devices
alter publication supabase_realtime add table public.meal_records;

-- =============================================================
-- RLS
-- =============================================================
alter table public.meal_records enable row level security;

create policy "meals: own read"
  on public.meal_records for select
  using (auth.uid() = user_id);

create policy "meals: volunteer/admin read all"
  on public.meal_records for select
  using (public.my_role() in ('admin', 'volunteer'));

create policy "meals: volunteer/admin insert"
  on public.meal_records for insert
  with check (public.my_role() in ('admin', 'volunteer'));

create policy "meals: volunteer/admin delete"
  on public.meal_records for delete
  using (public.my_role() in ('admin', 'volunteer'));
