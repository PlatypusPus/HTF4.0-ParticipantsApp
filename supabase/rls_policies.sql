-- =============================================================
-- HTF4.0 — Row Level Security Policies (consolidated)
-- Run AFTER schema.sql in: Supabase Dashboard → SQL Editor
-- =============================================================

-- Helper: current user's role
create or replace function public.my_role()
returns text
language sql
security definer
stable
as $$ select role from public.profiles where id = auth.uid() $$;

-- =============================================================
-- PROFILES
-- Any authenticated user can read profile rows — team_name and
-- team_code are already shown publicly on leaderboards, the
-- check-in monitor, and the song queue.
-- =============================================================
alter table public.profiles enable row level security;

create policy "profiles: authenticated read"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    role = (select role from public.profiles where id = auth.uid())
    and team_code = (select team_code from public.profiles where id = auth.uid())
    and team_name = (select team_name from public.profiles where id = auth.uid())
  );

create policy "profiles: admin update all"
  on public.profiles for update
  using (public.my_role() = 'admin');

create policy "profiles: volunteer mark checked_in"
  on public.profiles for update
  using (public.my_role() in ('admin', 'volunteer'));

-- =============================================================
-- TEAM MEMBERS
-- =============================================================
alter table public.team_members enable row level security;

create policy "members: own team read"
  on public.team_members for select
  using (team_id = auth.uid());

create policy "members: volunteer/admin read all"
  on public.team_members for select
  using (public.my_role() in ('admin', 'volunteer'));

create policy "members: volunteer/admin write"
  on public.team_members for all
  using (public.my_role() in ('admin', 'volunteer'))
  with check (public.my_role() in ('admin', 'volunteer'));

-- =============================================================
-- CHECK-INS
-- =============================================================
alter table public.checkins enable row level security;

create policy "checkins: own insert (idempotent)"
  on public.checkins for insert
  with check (auth.uid() = user_id);

create policy "checkins: own read"
  on public.checkins for select
  using (auth.uid() = user_id);

create policy "checkins: volunteer/admin read all"
  on public.checkins for select
  using (public.my_role() in ('admin', 'volunteer'));

create policy "checkins: volunteer/admin insert"
  on public.checkins for insert
  with check (public.my_role() in ('admin', 'volunteer'));

-- =============================================================
-- SONG QUEUE
-- =============================================================
alter table public.song_queue enable row level security;

create policy "queue: authenticated read"
  on public.song_queue for select
  using (auth.role() = 'authenticated');

create policy "queue: participant insert (no explicit)"
  on public.song_queue for insert
  with check (
    auth.role() = 'authenticated'
    and auth.uid() = added_by
    and is_explicit = false
  );

create policy "queue: admin update"
  on public.song_queue for update
  using (public.my_role() = 'admin');

create policy "queue: admin delete"
  on public.song_queue for delete
  using (public.my_role() = 'admin');

-- =============================================================
-- HELP REQUESTS
-- =============================================================
alter table public.help_requests enable row level security;

create policy "help: participant insert"
  on public.help_requests for insert
  with check (
    auth.role() = 'authenticated'
    and auth.uid() = user_id
  );

create policy "help: own read"
  on public.help_requests for select
  using (auth.uid() = user_id);

create policy "help: volunteer/admin read all"
  on public.help_requests for select
  using (public.my_role() in ('admin', 'volunteer'));

create policy "help: volunteer/admin update"
  on public.help_requests for update
  using (public.my_role() in ('admin', 'volunteer'));

-- =============================================================
-- MEAL RECORDS
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
