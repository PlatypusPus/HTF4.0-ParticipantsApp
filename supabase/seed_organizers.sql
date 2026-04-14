-- =============================================================
-- HTF4.0 — Seed Organizing Team as team_members under an "ORG"
-- profile so every organizer gets their own NFC sticker and
-- food-voucher meal cap (2× each meal type per person).
--
-- Run AFTER schema.sql, rls_policies.sql, seed.sql, seed_teams.sql.
-- Idempotent.
-- =============================================================

-- 1) Ensure the organizing-team profile exists (participant role;
--    they never log in, but the profile is the FK anchor).
select public.seed_team_auth('ORG', 'Organizing Team', 'participant', 'htforganize');

-- 2) Insert organizers as team_members under ORG. Skip names we
--    already have so re-runs are no-ops.
do $$
declare
  org_id uuid;
  n text;
  names text[] := array[
    'Shovin Dsouza',
    'Ashley Cleon Pinto',
    'Priyal Saldanha',
    'Ankit Shah',
    'Viona Noronha',
    'Melroy Almedia',
    'Chirag Shriyan',
    'Nithin',
    'Lishel Vilcia Lobo',
    'Shayan Salian',
    'Delwin Moras',
    'Lahari S',
    'Hemanth A N',
    'Jeethan Roche',
    'Dion Lobo',
    'Ashish Y G',
    'Shravya Santhosh',
    'Lenn Sequeira',
    'Sancia Sanctis',
    'Livona Dsouza',
    'Mohammad Shamoon',
    'Shreyas K',
    'Asher Pinto',
    'Jia Menezes',
    'Poornachandra',
    'Keerthana',
    'Shanice',
    'Rahul Mendon',
    'Vernon Dantes',
    'Stalon Dsouza',
    'Shaan Dsouza',
    'Dhanish S',
    'Vinay',
    'Riya Ann Dsilva',
    'Reyon Joseph',
    'Niharika',
    'Joel',
    'Ajay Preenal Dsouza',
    'Sana Akbar',
    'Milind',
    'Amulya Dsouza',
    'Carl Pinto',
    'Ashwil',
    'Ruben Saldanha',
    'Ajith',
    'Shivam S',
    'Ms Diana Monteiro',
    'Dr Shrisha H S',
    'Dr Aldrin Vaz',
    'Dr Rolvin Dsilva',
    'Mr Rajesh Belchada',
    'Ms Madhavi Gatty',
    'Mr Ajeeth B',
    'Ms Supreetha D R',
    'Ms Supriya Salian',
    'Ms Olivia Sequeira',
    'Mr Jostal Pinto',
    'Mr Davor John',
    'Mr Shivaganesh',
    'Ms Rakshitha',
    'Dr Saumya Y M',
    'Dr Sunitha Guruprasad',
    'Dr Binu K G',
    'Ms Vanisha Sathmayor',
    'Ms Prajna M',
    'Dr Vijay V S',
    'Ms Devikrishna K S',
    'Dr Vijetha U',
    'Ms Jaishma Kumari B',
    'Ms Nisha Roche',
    'Dr Saleena T S',
    'Mr Abhilash R V',
    'Mr Deepak Lobo',
    'Dr Sridevi Saralaya',
    'Dr Prathima S',
    'Ms Prajna K',
    'Dr Melvyn Dsouza',
    'Ms Dhanya R P',
    'Ms Pruthvi M R',
    'Dr Harivinod N'
  ];
begin
  select id into org_id from public.profiles where team_code = 'ORG';
  if org_id is null then
    raise exception 'ORG profile missing — run seed.sql/seed_teams.sql first';
  end if;

  foreach n in array names loop
    if not exists (
      select 1 from public.team_members
      where team_id = org_id and full_name = n
    ) then
      insert into public.team_members (team_id, full_name) values (org_id, n);
    end if;
  end loop;
end$$;
