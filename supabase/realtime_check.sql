-- =============================================================
-- If help_requests / meal_records updates aren't reaching the
-- volunteer screens live, run this in Supabase SQL Editor.
-- It ensures the tables are in the realtime publication and that
-- UPDATE events include full row data (needed for RLS match).
-- Safe to re-run; statements are idempotent.
-- =============================================================

do $$
begin
  -- Ensure tables are part of the realtime publication
  begin
    alter publication supabase_realtime add table public.help_requests;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.meal_records;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.song_queue;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.checkins;
  exception when duplicate_object then null;
  end;
end $$;

-- REPLICA IDENTITY FULL makes UPDATE / DELETE payloads include every column,
-- which is required for realtime to correctly evaluate RLS on changes.
alter table public.help_requests replica identity full;
alter table public.meal_records  replica identity full;
alter table public.song_queue    replica identity full;
alter table public.checkins      replica identity full;
