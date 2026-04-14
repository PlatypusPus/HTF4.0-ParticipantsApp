-- =============================================================
-- HTF4.0 — Clean Drop: fully reset the database
-- Removes all app tables, functions, triggers, policies, and the
-- auth.users rows seeded for teams. Run BEFORE re-running
-- schema.sql to get back to a pristine state.
--
-- Run in: Supabase Dashboard → SQL Editor. Idempotent.
-- WARNING: destroys all data in the listed tables. Cannot be undone.
-- =============================================================

-- Remove from realtime publication first (safe if not present).
do $$
declare t text;
begin
  foreach t in array array[
    'song_queue', 'help_requests', 'checkins',
    'meal_records', 'team_members', 'profiles'
  ] loop
    if exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end$$;

-- Drop tables (cascade takes care of indexes, triggers, FKs, policies).
drop table if exists public.help_requests cascade;
drop table if exists public.meal_records  cascade;
drop table if exists public.song_queue    cascade;
drop table if exists public.checkins      cascade;
drop table if exists public.team_members  cascade;
drop table if exists public.profiles      cascade;

-- Drop helper functions.
drop function if exists public.enforce_meal_cap() cascade;
drop function if exists public.my_role()          cascade;
drop function if exists public.seed_team_auth(text, text, text, text) cascade;

-- Drop the auth.users rows backing seeded teams.
-- Every seeded account uses {team_code}@htf.local, so this is safe.
delete from auth.users where email like '%@htf.local';
