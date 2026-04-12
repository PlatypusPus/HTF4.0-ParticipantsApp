-- =============================================================
-- HTF4.0 — Seed Script: Pre-create teams as Supabase Auth users
-- Run AFTER schema.sql + rls_policies.sql
--
-- Each team gets:
--   • An auth.users row with email = {team_code}@htf.local
--   • A profiles row with team_code, team_name, role
--
-- To add more teams, duplicate the block below and change
-- the team_code, team_name, password, and (optionally) role.
--
-- Works identically on local Supabase and cloud Supabase.
-- =============================================================

-- Idempotent helper: safe to re-run seed.sql multiple times.
create or replace function public.seed_team_auth(
  _team_code text,
  _team_name text,
  _role text,
  _password text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _normalized_team_code text := upper(trim(_team_code));
  _email text := lower(trim(_team_code)) || '@htf.local';
  _uid uuid;
begin
  -- 1) Find existing auth user by internal email, or create it.
  select id into _uid
  from auth.users
  where email = _email
  limit 1;

  if _uid is null then
    _uid := gen_random_uuid();

    insert into auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      confirmation_token, recovery_token,
      email_change, email_change_token_new,
      email_confirmed_at, confirmation_sent_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      _uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      _email,
      extensions.crypt(_password, extensions.gen_salt('bf')),
      '', '',
      '', '',
      now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('team_code', _normalized_team_code),
      now(), now()
    );
  else
    -- Keep password/meta in sync on reruns.
    update auth.users
    set encrypted_password = extensions.crypt(_password, extensions.gen_salt('bf')),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object('team_code', _normalized_team_code),
        updated_at = now()
    where id = _uid;
  end if;

  -- 2) Ensure email identity exists for signInWithPassword.
  if not exists (
    select 1
    from auth.identities
    where provider = 'email'
      and provider_id = _email
  ) then
    insert into auth.identities (
      id, user_id, provider_id, provider,
      identity_data, last_sign_in_at,
      created_at, updated_at
    ) values (
      gen_random_uuid(),
      _uid,
      _email,
      'email',
      jsonb_build_object('sub', _uid::text, 'email', _email),
      now(), now(), now()
    );
  end if;

  -- 3) Ensure profile exists and stays aligned with seed values.
  insert into public.profiles (id, team_code, team_name, role)
  values (_uid, _normalized_team_code, _team_name, _role)
  on conflict (id) do update
    set team_code = excluded.team_code,
        team_name = excluded.team_name,
        role = excluded.role;
end;
$$;

-- Seed teams (safe to re-run).
select public.seed_team_auth('T02', 'Team T02', 'participant', 'team02');
select public.seed_team_auth('VOLUNTEER', 'Volunteer', 'volunteer', 'htfvolunteer');
select public.seed_team_auth('ADMIN', 'Admin', 'admin', 'admin123');
