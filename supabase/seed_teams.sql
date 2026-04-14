-- =============================================================
-- HTF4.0 — Seed all teams + the volunteer account
-- Source: NFC Data/Participants App Credentials.csv
--
-- Run AFTER schema.sql + rls_policies.sql + seed.sql (which ships
-- the public.seed_team_auth helper used below).
--
-- Safe to re-run: the helper upserts the auth user + profile and
-- rotates the password to whatever you pass in.
-- =============================================================

-- Devops track (D01–D10)
select public.seed_team_auth('D01', 'The Mob glitch',  'participant', 'THEMD01');
select public.seed_team_auth('D02', 'Devil''s Den',    'participant', 'DEVILD02');
select public.seed_team_auth('D03', 'The_Quad',        'participant', 'THEQD03');
select public.seed_team_auth('D04', 'Elite Hackers',   'participant', 'ELITD04');
select public.seed_team_auth('D05', 'We don''t know',  'participant', 'WEDOD05');
select public.seed_team_auth('D06', 'Lil Kids',        'participant', 'LILKD06');
select public.seed_team_auth('D07', 'fun-tastick',     'participant', 'FUNTD07');
select public.seed_team_auth('D08', 'BROKENCODE',      'participant', 'BROKD08');
select public.seed_team_auth('D09', 'logic loopers',   'participant', 'LOGID09');
select public.seed_team_auth('D10', 'CODE_CRAFTERS',   'participant', 'CODED10');

-- Cyberspace track (C01–C10)
select public.seed_team_auth('C01', 'Boss Bandits',       'participant', 'BOSSC01');
select public.seed_team_auth('C02', 'Trial And Error',    'participant', 'TRIAC02');
select public.seed_team_auth('C03', 'NovaQ',              'participant', 'NOVAC03');
select public.seed_team_auth('C04', 'NexALS',             'participant', 'NEXAC04');
select public.seed_team_auth('C05', 'Silicon Colosseum',  'participant', 'SILIC05');
select public.seed_team_auth('C06', 'Dollar $ign',        'participant', 'DOLLC06');
select public.seed_team_auth('C07', 'Team Novice',        'participant', 'TEAMC07');
select public.seed_team_auth('C08', 'Trailblazers',       'participant', 'TRAILC08');
select public.seed_team_auth('C09', 'The Brainiacs',      'participant', 'THEBC09');
select public.seed_team_auth('C10', 'Cyanide boys',       'participant', 'CYANC10');

-- Cloud track (A01–A10)
select public.seed_team_auth('A01', 'Code Brigade',    'participant', 'CODEA01');
select public.seed_team_auth('A02', 'Byte Me',         'participant', 'BYTEA02');
select public.seed_team_auth('A03', 'Visionaries',     'participant', 'VISIA03');
select public.seed_team_auth('A04', 'INVOX',           'participant', 'INVOA04');
select public.seed_team_auth('A05', 'NeuralOps',       'participant', 'NEURA05');
select public.seed_team_auth('A06', 'Codeclan',        'participant', 'CODEA06');
select public.seed_team_auth('A07', 'RanOutOfTokens',  'participant', 'RANA07');
select public.seed_team_auth('A08', 'SheCodes',        'participant', 'SHECA08');
select public.seed_team_auth('A09', 'Faleris',         'participant', 'FALEA09');
select public.seed_team_auth('A10', 'Clueless',        'participant', 'CLUEA10');

-- OpenInnovation track (I01–I11)
select public.seed_team_auth('I01', 'The Specter Sentinels', 'participant', 'THESI01');
select public.seed_team_auth('I02', 'Sphinx',                'participant', 'SPHII02');
select public.seed_team_auth('I03', 'Abra Code Abra',        'participant', 'ABRAI03');
select public.seed_team_auth('I04', 'MindMesh',              'participant', 'MINDI04');
select public.seed_team_auth('I05', 'Obsidian',              'participant', 'OBSDI05');
select public.seed_team_auth('I06', 'Last Minute',           'participant', 'LASTI06');
select public.seed_team_auth('I07', 'CODEMAFIANS',           'participant', 'CODEI07');
select public.seed_team_auth('I08', 'BlueBerry',             'participant', 'BLUEI08');
select public.seed_team_auth('I09', 'Did he warriors',       'participant', 'DIDHI09');
select public.seed_team_auth('I10', 'BORN2CODE',             'participant', 'BORNI10');
select public.seed_team_auth('I11', 'Code_Slayers',          'participant', 'CODEI11');

-- Volunteer
select public.seed_team_auth('000', 'Volunteer', 'volunteer', 'htf');
