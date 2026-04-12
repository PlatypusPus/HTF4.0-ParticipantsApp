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
create table public.profiles (
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
create table public.checkins (
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
create table public.song_queue (
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

create index on public.song_queue (is_played, position);

-- =============================================================
-- MEDIA GALLERY
-- =============================================================
create table public.media_items (
  id            uuid primary key default gen_random_uuid(),
  uploaded_by   uuid references public.profiles(id) on delete set null,
  storage_path  text not null,
  public_url    text not null,
  media_type    text not null check (media_type in ('image', 'video')),
  caption       text,
  is_approved   boolean not null default true,
  is_flagged    boolean not null default false,
  flag_reason   text,
  flagged_by    uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index on public.media_items (is_approved, uploaded_at desc);
create index on public.media_items (is_flagged) where is_flagged = true;

-- =============================================================
-- HELP REQUESTS
-- =============================================================
create table public.help_requests (
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

create index on public.help_requests (status, created_at desc);

-- =============================================================
-- REALTIME PUBLICATIONS
-- =============================================================
alter publication supabase_realtime add table public.song_queue;
alter publication supabase_realtime add table public.help_requests;
alter publication supabase_realtime add table public.media_items;
alter publication supabase_realtime add table public.checkins;

-- =============================================================
-- NOTE: No auto-create trigger. Teams are pre-seeded via the
-- seed script (supabase/seed.sql) or manually via SQL Editor.
-- =============================================================

-- =============================================================
-- STORAGE BUCKET
-- Run in Supabase Dashboard → Storage → New bucket
-- Name: event-media | Public: true | File size limit: 50MB
-- Allowed types: image/*, video/*
-- =============================================================
-- insert into storage.buckets (id, name, public) values ('event-media', 'event-media', true);
