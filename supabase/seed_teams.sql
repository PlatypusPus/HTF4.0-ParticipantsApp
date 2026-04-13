-- =============================================================
-- HTF4.0 — Seed ALL teams from the four NFC Data CSVs.
-- Run AFTER schema.sql + rls_policies.sql (seed.sql first if you
-- also want the VOLUNTEER / ADMIN accounts).
--
-- Uses the helper public.seed_team_auth(code, name, role, password)
-- that ships in seed.sql — so run seed.sql at least once first.
--
-- Default password scheme: 'htf' || lower(team_code), e.g. A01 -> 'htfa01'.
-- Change any password by editing the third argument before running, or
-- re-run with a different password to rotate it (idempotent).
-- =============================================================

-- Cloud track (A01–A10)
select public.seed_team_auth('A01', 'Cloud A01', 'participant', 'htfa01');
select public.seed_team_auth('A02', 'Cloud A02', 'participant', 'htfa02');
select public.seed_team_auth('A03', 'Cloud A03', 'participant', 'htfa03');
select public.seed_team_auth('A04', 'Cloud A04', 'participant', 'htfa04');
select public.seed_team_auth('A05', 'Cloud A05', 'participant', 'htfa05');
select public.seed_team_auth('A06', 'Cloud A06', 'participant', 'htfa06');
select public.seed_team_auth('A07', 'Cloud A07', 'participant', 'htfa07');
select public.seed_team_auth('A08', 'Cloud A08', 'participant', 'htfa08');
select public.seed_team_auth('A09', 'Cloud A09', 'participant', 'htfa09');
select public.seed_team_auth('A10', 'Cloud A10', 'participant', 'htfa10');

-- Cyberspace track (C01–C10)
select public.seed_team_auth('C01', 'Cyberspace C01', 'participant', 'htfc01');
select public.seed_team_auth('C02', 'Cyberspace C02', 'participant', 'htfc02');
select public.seed_team_auth('C03', 'Cyberspace C03', 'participant', 'htfc03');
select public.seed_team_auth('C04', 'Cyberspace C04', 'participant', 'htfc04');
select public.seed_team_auth('C05', 'Cyberspace C05', 'participant', 'htfc05');
select public.seed_team_auth('C06', 'Cyberspace C06', 'participant', 'htfc06');
select public.seed_team_auth('C07', 'Cyberspace C07', 'participant', 'htfc07');
select public.seed_team_auth('C08', 'Cyberspace C08', 'participant', 'htfc08');
select public.seed_team_auth('C09', 'Cyberspace C09', 'participant', 'htfc09');
select public.seed_team_auth('C10', 'Cyberspace C10', 'participant', 'htfc10');

-- Devops track (D01–D10)
select public.seed_team_auth('D01', 'Devops D01', 'participant', 'htfd01');
select public.seed_team_auth('D02', 'Devops D02', 'participant', 'htfd02');
select public.seed_team_auth('D03', 'Devops D03', 'participant', 'htfd03');
select public.seed_team_auth('D04', 'Devops D04', 'participant', 'htfd04');
select public.seed_team_auth('D05', 'Devops D05', 'participant', 'htfd05');
select public.seed_team_auth('D06', 'Devops D06', 'participant', 'htfd06');
select public.seed_team_auth('D07', 'Devops D07', 'participant', 'htfd07');
select public.seed_team_auth('D08', 'Devops D08', 'participant', 'htfd08');
select public.seed_team_auth('D09', 'Devops D09', 'participant', 'htfd09');
select public.seed_team_auth('D10', 'Devops D10', 'participant', 'htfd10');

-- OpenIno track (I01–I11)
select public.seed_team_auth('I01', 'OpenIno I01', 'participant', 'htfi01');
select public.seed_team_auth('I02', 'OpenIno I02', 'participant', 'htfi02');
select public.seed_team_auth('I03', 'OpenIno I03', 'participant', 'htfi03');
select public.seed_team_auth('I04', 'OpenIno I04', 'participant', 'htfi04');
select public.seed_team_auth('I05', 'OpenIno I05', 'participant', 'htfi05');
select public.seed_team_auth('I06', 'OpenIno I06', 'participant', 'htfi06');
select public.seed_team_auth('I07', 'OpenIno I07', 'participant', 'htfi07');
select public.seed_team_auth('I08', 'OpenIno I08', 'participant', 'htfi08');
select public.seed_team_auth('I09', 'OpenIno I09', 'participant', 'htfi09');
select public.seed_team_auth('I10', 'OpenIno I10', 'participant', 'htfi10');
select public.seed_team_auth('I11', 'OpenIno I11', 'participant', 'htfi11');
