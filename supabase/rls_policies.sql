-- =============================================================
-- HTF4.0 — Row Level Security Policies
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
-- =============================================================
alter table public.profiles enable row level security;

create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: admin read all"
  on public.profiles for select
  using (public.my_role() = 'admin');

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    -- Prevent self-escalation of role
    role = (select role from public.profiles where id = auth.uid())
    -- Keep identity fields immutable for non-admin self-updates
    and team_code = (select team_code from public.profiles where id = auth.uid())
    and team_name = (select team_name from public.profiles where id = auth.uid())
  );

create policy "profiles: admin update all"
  on public.profiles for update
  using (public.my_role() = 'admin');

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
-- MEDIA ITEMS
-- =============================================================
alter table public.media_items enable row level security;

create policy "media: view approved"
  on public.media_items for select
  using (auth.role() = 'authenticated' and is_approved = true);

create policy "media: admin view all"
  on public.media_items for select
  using (public.my_role() = 'admin');

create policy "media: participant upload"
  on public.media_items for insert
  with check (
    auth.role() = 'authenticated'
    and auth.uid() = uploaded_by
  );

create policy "media: participant flag own or others"
  on public.media_items for update
  using (auth.role() = 'authenticated')
  with check (
    -- Participants can only set is_flagged=true
    is_flagged = true
    and flagged_by = auth.uid()
    -- Prevent participants from changing other fields
    and is_approved = (select is_approved from public.media_items where id = media_items.id)
  );

create policy "media: admin moderate"
  on public.media_items for update
  using (public.my_role() = 'admin');

create policy "media: admin delete"
  on public.media_items for delete
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
-- STORAGE POLICIES (via Supabase Dashboard or SQL below)
-- These apply to the 'event-media' bucket
-- =============================================================

/*
create policy "storage: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-media');

create policy "storage: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'event-media');

create policy "storage: owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "storage: admin delete all"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-media'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
*/
