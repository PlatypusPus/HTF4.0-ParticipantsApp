-- =============================================================
-- HTF4.0 — Drop the media gallery feature
-- Removes the media_items table and its realtime publication.
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='media_items'
  ) then
    alter publication supabase_realtime drop table public.media_items;
  end if;
end$$;

drop table if exists public.media_items cascade;
