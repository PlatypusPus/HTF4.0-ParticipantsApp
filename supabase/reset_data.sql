-- =============================================================
-- HTF4.0 — Wipe all app data
-- Truncates every app table so you can re-seed from scratch.
-- Run in: Supabase Dashboard → SQL Editor.
-- Safe to re-run. Schema, RLS, policies, and triggers are untouched.
-- =============================================================

truncate table
  public.help_requests,
  public.meal_records,
  public.song_queue,
  public.checkins,
  public.team_members,
  public.profiles
restart identity cascade;

-- =============================================================
-- Optional: also delete the Supabase Auth users that backed those
-- profiles. Uncomment ONLY if you want a completely clean slate
-- (e.g. before re-seeding teams with a different code/password set).
-- This cannot be undone.
-- =============================================================
-- delete from auth.users where email like '%@htf.local';
