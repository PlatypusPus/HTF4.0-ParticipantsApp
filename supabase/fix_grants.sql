-- =============================================================
-- HTF4.0 — Grant fix
-- Symptom: REST calls return 403 "permission denied for table ..."
-- even though RLS policies look correct.
-- Cause: the `anon`/`authenticated` roles have no GRANT on tables
-- created after a drop/recreate. RLS only narrows what's visible;
-- it cannot grant privileges that Postgres never gave the role.
--
-- Run in: Supabase Dashboard → SQL Editor. Idempotent.
-- =============================================================

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- Make sure any future tables inherit the same grants automatically.
alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
