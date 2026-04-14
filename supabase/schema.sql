-- =============================================================
-- HTF4.0 Participants App — Supabase Schema (consolidated)
-- Run this in: Supabase Dashboard → SQL Editor
-- Then run rls_policies.sql, seed.sql, seed_teams.sql.
-- =============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================
-- GRANTS — Supabase's PostgREST uses the `anon` and `authenticated`
-- roles. New tables need explicit GRANTs; otherwise the REST API
-- returns 403 "permission denied for table" even when RLS would pass.
-- Default privileges ensure any future table inherits the same grants.
-- =============================================================
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- =============================================================
-- PROFILES — one row per team/volunteer/admin. Auth users are
-- pre-seeded with email {team_code}@htf.local.
-- =============================================================
create table if not exists public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  team_code     text unique not null,
  team_name     text not null,
  role          text not null default 'participant'
                  check (role in ('participant', 'volunteer', 'admin')),
  checked_in    boolean not null default false,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now()
);

-- =============================================================
-- TEAM MEMBERS — N individuals per team. NFC stickers store
-- only the team_member.id; team_name resolves via team_id FK.
-- =============================================================
create table if not exists public.team_members (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid references public.profiles(id) on delete cascade not null,
  full_name     text not null,
  checked_in    boolean not null default false,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists team_members_team_idx on public.team_members (team_id);

-- =============================================================
-- CHECK-INS — one row per team (team-level) and/or per member.
-- A team can have both a team-level row (team_member_id null)
-- and per-member rows. Partial unique indexes enforce single
-- check-in per level.
-- =============================================================
create table if not exists public.checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete cascade not null,
  team_member_id uuid references public.team_members(id) on delete set null,
  checked_in_at  timestamptz not null default now(),
  location_lat   double precision,
  location_lng   double precision
);

-- Older deployments had `checkins.user_id` as a UNIQUE column.
-- Drop that so we can coexist with per-member check-ins.
alter table public.checkins drop constraint if exists checkins_user_id_key;

create unique index if not exists checkins_team_unique
  on public.checkins (user_id) where team_member_id is null;

create unique index if not exists checkins_member_unique
  on public.checkins (team_member_id) where team_member_id is not null;

create index if not exists checkins_team_id_idx on public.checkins (user_id);

-- =============================================================
-- SONG QUEUE
-- =============================================================
create table if not exists public.song_queue (
  id                uuid primary key default gen_random_uuid(),
  spotify_track_id  text not null,
  track_name        text not null,
  artist_name       text not null,
  album_art         text,
  duration_ms       integer,
  is_explicit       boolean not null default false,
  added_by          uuid references public.profiles(id) on delete set null,
  added_at          timestamptz not null default now(),
  position          integer not null default 0,
  is_playing        boolean not null default false,
  is_played         boolean not null default false
);

create index if not exists song_queue_played_position_idx on public.song_queue (is_played, position);

-- =============================================================
-- HELP REQUESTS
-- =============================================================
create table if not exists public.help_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade not null,
  help_type    text not null check (help_type in ('medical', 'technical', 'general')),
  notes        text,
  location_lat double precision,
  location_lng double precision,
  status       text not null default 'pending'
                 check (status in ('pending', 'in_progress', 'resolved')),
  assigned_to  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists help_requests_status_created_idx on public.help_requests (status, created_at desc);

-- =============================================================
-- MEAL RECORDS — 2 of each meal type per participant over the
-- 3-day event. When team_member_id is set, the cap is per
-- member; otherwise it is per team (legacy fallback).
-- =============================================================
create table if not exists public.meal_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete cascade not null,
  team_member_id uuid references public.team_members(id) on delete set null,
  meal_type      text not null check (meal_type in ('breakfast', 'lunch', 'dinner')),
  served_by      uuid references public.profiles(id) on delete set null,
  served_at      timestamptz not null default now(),
  meal_date      date not null default (now() at time zone 'utc')::date
);

create index if not exists meal_records_served_at_idx on public.meal_records (served_at desc);
create index if not exists meal_records_member_idx on public.meal_records (team_member_id, meal_type);

create or replace function public.enforce_meal_cap()
returns trigger
language plpgsql
as $$
declare
  existing_count int;
  lock_key bigint;
begin
  -- Transaction-scoped advisory lock keyed by (subject, meal_type). Two
  -- volunteers scanning the same person at the same instant will serialize
  -- here so the count/insert is race-free.
  lock_key := hashtextextended(
    coalesce(new.team_member_id::text, new.user_id::text) || '|' || new.meal_type,
    0
  );
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

drop trigger if exists meal_records_enforce_cap on public.meal_records;
create trigger meal_records_enforce_cap
before insert on public.meal_records
for each row execute function public.enforce_meal_cap();

-- =============================================================
-- REALTIME PUBLICATIONS + replica identity full
-- (full row payloads are needed so RLS can evaluate on UPDATE).
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'song_queue', 'help_requests', 'checkins',
    'meal_records', 'team_members'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end$$;

alter table public.song_queue    replica identity full;
alter table public.help_requests replica identity full;
alter table public.checkins      replica identity full;
alter table public.meal_records  replica identity full;
alter table public.team_members  replica identity full;

-- =============================================================
-- Re-apply grants to the tables created above. `alter default
-- privileges` only affects objects created AFTER the grant statement
-- is run, so existing tables need an explicit grant pass too.
-- =============================================================
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
