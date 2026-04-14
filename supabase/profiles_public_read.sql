-- =============================================================
-- Allow any authenticated user to read profile rows so that joins
-- like song_queue.profiles(team_name, team_code) resolve for
-- everyone — not just the row owner and admins.
--
-- This is safe for this app because team_name + team_code are
-- already displayed publicly on the leaderboard, check-in monitor,
-- and song queue. No truly sensitive columns exist here.
--
-- Run once in Supabase Dashboard → SQL Editor. Idempotent.
-- =============================================================

drop policy if exists "profiles: authenticated read" on public.profiles;

create policy "profiles: authenticated read"
  on public.profiles for select
  using (auth.role() = 'authenticated');
