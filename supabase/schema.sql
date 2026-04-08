-- =============================================================
-- HTF4.0 Participants App — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- =============================================================
-- PROFILES (extends auth.users)
-- =============================================================
create table public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  full_name     text not null default 'Participant',
  team_id       text,
  team_code     text,
  team_name     text,
  role          text not null default 'participant'
                  check (role in ('participant', 'volunteer', 'admin')),
  checked_in    boolean not null default false,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.profiles is 'One row per authenticated user. Role controls RBAC.';

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

comment on column public.checkins.user_id is 'UNIQUE constraint prevents duplicate check-ins per participant.';

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
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- Picks up full_name + team_id from signInWithOtp data option
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _team_id text;
begin
  _team_id := upper(new.raw_user_meta_data->>'team_id');
  insert into public.profiles (id, full_name, team_id, team_code, team_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Participant'),
    _team_id,
    _team_id,
    case when _team_id is not null then 'Team ' || _team_id else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================
-- STORAGE BUCKET
-- Run in Supabase Dashboard → Storage → New bucket
-- Name: event-media | Public: true | File size limit: 50MB
-- Allowed types: image/*, video/*
-- =============================================================
-- insert into storage.buckets (id, name, public) values ('event-media', 'event-media', true);
