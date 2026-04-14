-- =============================================================
-- HTF4.0 Participants App — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================
-- PROFILES (extends auth.users — one per team/volunteer)
-- Each team is a single Supabase Auth user with email
-- {team_code}@htf.local and a pre-shared password.
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

comment on table public.profiles is 'One row per team/volunteer. Role controls RBAC. Teams are pre-seeded, no signup.';

-- =============================================================
-- CHECK-INS
-- =============================================================
create table if not exists public.checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete cascade not null unique,
  checked_in_at  timestamptz not null default now(),
  location_lat   double precision,
  location_lng   double precision
);

comment on column public.checkins.user_id is 'UNIQUE constraint prevents duplicate check-ins per team.';

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
-- REALTIME PUBLICATIONS
-- =============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='song_queue') then
    alter publication supabase_realtime add table public.song_queue;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='help_requests') then
    alter publication supabase_realtime add table public.help_requests;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='checkins') then
    alter publication supabase_realtime add table public.checkins;
  end if;
end$$;

-- =============================================================
-- NOTE: No auto-create trigger. Teams are pre-seeded via the
-- seed script (supabase/seed.sql) or manually via SQL Editor.
-- =============================================================
