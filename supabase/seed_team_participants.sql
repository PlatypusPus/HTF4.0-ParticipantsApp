-- =============================================================
-- HTF4.0 — Seed participant team_members from the NFC roster.
-- Source of truth: src/data/nfcTeams.js (same list used by
-- NfcWriteScreen to write the stickers).
--
-- Run AFTER schema.sql, rls_policies.sql, seed.sql, seed_teams.sql.
-- Idempotent: re-running adds only missing rows.
-- =============================================================

do $$
declare
  m record;
  team_id_var uuid;
  missing_count int := 0;
  roster constant text[][] := array[
    array['A01','Touheed Pasha'], array['A01','Shreya Pal'], array['A01','Pooja A'],
    array['A02','Daksh Pravin Mehta'], array['A02','Krish Bharat Parmar'], array['A02','Chintan Mange'],
    array['A03','Bhumika M Devadiga'], array['A03','Meghana Achar'], array['A03','Indraj A G'], array['A03','G Sajan Kumar'],
    array['A04','Shaman Krishna'], array['A04','Vinay'], array['A04','Ashish M Rao'], array['A04','Suraj P S'],
    array['A05','Harshanandan'], array['A05','Arun'], array['A05','Anan Mohith K V'], array['A05','Bhavith A Shetty'],
    array['A06','Ayush Bhandari'], array['A06','Sudarshan K Naik'], array['A06','Vishruth G Hegde'], array['A06','Arav Shah'],
    array['A07','Vivek Neeralagi'], array['A07','Aravind P Sagar'], array['A07','Rajath'], array['A07','Kushal Sonnad Math'],
    array['A08','Neha Rai'], array['A08','Prajna'], array['A08','Khushi V R'], array['A08','Anusha P'],
    array['A09','Ranjan Kumar'], array['A09','Maneesha Hegade'], array['A09','Sujay M'],
    array['A10','Jnanesh'], array['A10','Krithi A S'],
    array['C01','Shawn Saldanha'], array['C01','Sarthak Priyadarshi'], array['C01','Santhsim Virile Dsouza'], array['C01','Reuben Antony Vinod'],
    array['C02','Bhavana M J'], array['C02','Arya Khaded'], array['C02','Mayur N'], array['C02','Thirumalesh K'],
    array['C03','Prathiba Devi V S'], array['C03','Gurunathan R'], array['C03','Raghunandhan Gopalan'], array['C03','Abinesh B'],
    array['C04','Linsha Neha Bangera'], array['C04','Ashlin Rodrigues'], array['C04','Sweedal Grace Pinto'],
    array['C05','Derric Samson'], array['C05','Dinesh T'], array['C05','Kevin Immanuel'],
    array['C06','Sachin S'], array['C06','Priyanshu Singh'], array['C06','Mahesh Arun Aladi'], array['C06','Md Ifraz Yousuf'],
    array['C07','Arjun Dinesh Gowda'], array['C07','Sudesh Poojary'], array['C07','Yuganth Shetty'], array['C07','Happy Khadka'],
    array['C08','Kavya Nair'], array['C08','Sreerangan Sreeraman'], array['C08','Monisha R K'], array['C08','N S Panisree Padeswari'],
    array['C09','Manvitha Ravi Salian'], array['C09','Pruthvi Shetty'],
    array['C10','Nihal'], array['C10','Manvith Moolya'], array['C10','Kirthi Pratham Shetty'], array['C10','Hithesh Shetty'],
    array['D01','Mohammed Aqib Moez'], array['D01','Aatif Ulla Khan'], array['D01','Syed Zayed'], array['D01','Syed Saliq Alishah'],
    array['D02','Naman Mani'], array['D02','Tanya Rishikesh'], array['D02','Indraneel Chatterjee'],
    array['D03','G Harshitha'], array['D03','Gokul P'], array['D03','P Avanthika'], array['D03','Arfath Shajakan'],
    array['D04','Prathwikumar M Gader'], array['D04','Tejas Shetti'], array['D04','Navneet Bant'], array['D04','Aniket Gudigar'],
    array['D05','Amith Colaco'], array['D05','Arjun Narayan'], array['D05','Vishnu Vardhan'], array['D05','Abhinav Shetty'],
    array['D06','Ananya Gupta'], array['D06','Sarva Dubey'], array['D06','Abhijeet Yadav'], array['D06','Siddhi Agarwal'],
    array['D07','Dibyendu Sahoo'], array['D07','Chirag D S'], array['D07','Simran Nagekar'],
    array['D08','Adithya A'], array['D08','Yash Kumar Singh'], array['D08','Priyanshu Kumar Rai'],
    array['D09','Prajwal Gaonkar'], array['D09','Kanak Tanwar'], array['D09','Mohit'], array['D09','Karthik'],
    array['D10','Gautam Naveen Rao'], array['D10','Georgie Shibu George'], array['D10','Zainaba Fida'],
    array['I01','Sarita Damodar Naik'], array['I01','Pranav Sanjay M'], array['I01','Suhruth N S'],
    array['I02','Prajval Kumar'], array['I02','Sampath Kumar'],
    array['I03','Muhammad Haashid'], array['I03','Vineeth S N'], array['I03','Mohammed Shakeeb'], array['I03','Mohammed Sinan'],
    array['I04','Reshal Sequeira'], array['I04','Meloni Jonita Quadras'], array['I04','Reeshal Saldanha'], array['I04','Ayesha Shama'],
    array['I05','Preran C V N'], array['I05','Samuel Lazar'], array['I05','Monish L'], array['I05','G Yashaswini'],
    array['I06','Dhwani Dhingra'], array['I06','Ashwin Rajan'], array['I06','Pratik Deshmukh'], array['I06','Vaibhavi Apshinge'],
    array['I07','Deepushree H P'], array['I07','Ananya A Badkar'], array['I07','Moinuddin Fazil'], array['I07','Mohammed Anfal'],
    array['I08','Mohammed Abrar'], array['I08','Hanisha Kohli'], array['I08','Shawn Taran Robin Rohit'], array['I08','Mayasah Mahwish Tariq'],
    array['I09','Manish Dsouza'], array['I09','Ashith K'], array['I09','F Manasvi'], array['I09','Hyarline Pereira'],
    array['I10','Onkar Bevinakatti'], array['I10','Meghana Kotambari'],
    array['I11','Srinidhi S Joshi'], array['I11','Pratibhavati S Ambiger'], array['I11','Ramya R Prabhu'], array['I11','Sahana Joshi']
  ];
  i int;
begin
  for i in 1 .. array_length(roster, 1) loop
    select id into team_id_var from public.profiles where team_code = roster[i][1];
    if team_id_var is null then
      missing_count := missing_count + 1;
      continue;
    end if;

    if not exists (
      select 1 from public.team_members
      where team_id = team_id_var
        and lower(btrim(full_name)) = lower(btrim(roster[i][2]))
    ) then
      insert into public.team_members (team_id, full_name) values (team_id_var, roster[i][2]);
    end if;
  end loop;

  if missing_count > 0 then
    raise notice '% rows skipped — their team profiles are missing (run seed_teams.sql first)', missing_count;
  end if;
end$$;
