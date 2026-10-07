-- PAYIT FC — database voor het selectieplatform (selectie.html)
-- Gebruik: plak dit hele bestand in Supabase > SQL Editor en klik op Run.
-- Opnieuw uitvoeren mag altijd: bestaande gegevens (pincodes, antwoorden, selecties) blijven staan.
--
-- Opzet: de tabellen staan in het schema "selectie", dat NIET via de API bereikbaar is.
-- De website praat alleen met de functies public.sel_…, en die vragen (behalve de namenlijst
-- en het aanmelden) altijd een geldige sessie van een speler.

create schema if not exists selectie;

create table if not exists selectie.players (
  id int primary key,
  first text not null,
  last text not null,
  sortkey text not null,            -- alfabetisch op familienaam, bepaalt de lotnummers
  is_admin boolean not null default false,
  active boolean not null default true,
  pin_salt text,
  pin_hash text,
  fails int not null default 0,
  locked_until timestamptz
);

create table if not exists selectie.sessions (
  token uuid primary key default gen_random_uuid(),
  player_id int not null references selectie.players(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists selectie.matches (
  id int generated always as identity primary key,
  key text not null unique,         -- "thuisploeg|uitploeg", zoals in js/data.js
  home text not null,
  away text not null,
  place text,
  kickoff timestamptz,              -- leeg = uitgesteld, nieuwe datum nog niet bekend
  finalized_at timestamptz,         -- ingevuld zodra de inschrijving afgesloten en de selectie gemaakt is
  result jsonb
);

create table if not exists selectie.availability (
  match_id int not null references selectie.matches(id) on delete cascade,
  player_id int not null references selectie.players(id) on delete cascade,
  status text not null check (status in ('ja', 'nee')),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create table if not exists selectie.lineup (
  match_id int not null references selectie.matches(id) on delete cascade,
  player_id int not null references selectie.players(id) on delete cascade,
  via text not null default 'zeker' check (via in ('zeker', 'loting', 'manueel')),
  primary key (match_id, player_id)
);

alter table selectie.players enable row level security;
alter table selectie.sessions enable row level security;
alter table selectie.matches enable row level security;
alter table selectie.availability enable row level security;
alter table selectie.lineup enable row level security;

/* ------------------------------------------------------------------ hulpfuncties */

create or replace function selectie.pin_hash(p_salt text, p_pin text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(p_salt || p_pin, 'UTF8')), 'hex')
$$;

-- inschrijving sluit 2 dagen voor de aftrap, op hetzelfde uur in Belgische tijd (ook rond het winteruur)
create or replace function selectie.deadline(p_kickoff timestamptz) returns timestamptz
language sql immutable as $$
  select ((p_kickoff at time zone 'Europe/Brussels') - interval '2 days') at time zone 'Europe/Brussels'
$$;

-- aanduiden kan alleen voor de eerstvolgende 3 matchen
create or replace function selectie.selectable(p_match int) returns boolean
language sql stable set search_path = selectie, public as $$
  select p_match in (select id from matches where kickoff > now() order by kickoff, id limit 3)
$$;

-- het SHA-256-getal modulo n (de hash is te groot voor een gewoon getal, dus byte per byte)
create or replace function selectie.hash_mod(p_hash bytea, p_n int) returns int
language plpgsql immutable as $$
declare
  acc bigint := 0;
  i int;
begin
  for i in 0 .. length(p_hash) - 1 loop
    acc := (acc * 256 + get_byte(p_hash, i)) % p_n;
  end loop;
  return acc::int;
end $$;

create or replace function selectie.auth(p_token text) returns selectie.players
language plpgsql stable set search_path = selectie, public as $$
declare
  v selectie.players;
begin
  select p.* into v from selectie.sessions s join selectie.players p on p.id = s.player_id
   where s.token::text = p_token and p.active;
  if not found then raise exception 'NOT_LOGGED_IN'; end if;
  return v;
end $$;

-- Maakt de selectie voor één match: wie kan en het minst speelde is zeker, bij gelijke stand
-- op de laatste plaatsen beslist een controleerbare loting. Maximum 8 spelers, minimum 5.
create or replace function selectie.finalize_match(p_match int) returns void
language plpgsql set search_path = selectie, public as $$
declare
  c_spots constant int := 8;
  c_min constant int := 5;
  v_kick timestamptz;
  v_ids int[];
  v_cnts int[];
  v_n int;
  v_th int;
  v_sure int := 0;
  v_open int := 0;
  v_tied int[] := '{}';
  v_seed text;
  v_text text;
  v_hash bytea;
  v_rest int;
  v_len int;
  v_counts jsonb := '{}';
  v_rounds jsonb := '[]';
  v_cands jsonb := '[]';
  i int;
  r int;
begin
  select kickoff into v_kick from matches where id = p_match and finalized_at is null for update;
  if not found or v_kick is null then return; end if;

  select array_agg(c.pid order by c.cnt, c.sortkey collate "C"), array_agg(c.cnt order by c.cnt, c.sortkey collate "C")
    into v_ids, v_cnts
    from (
      select a.player_id as pid, p.sortkey,
             (select count(*) from lineup l join matches m2 on m2.id = l.match_id
               where l.player_id = a.player_id and m2.finalized_at is not null and m2.kickoff < v_kick)::int as cnt
        from availability a join players p on p.id = a.player_id
       where a.match_id = p_match and a.status = 'ja' and p.active
    ) c;
  v_n := coalesce(array_length(v_ids, 1), 0);

  for i in 1 .. v_n loop
    v_counts := v_counts || jsonb_build_object(v_ids[i]::text, v_cnts[i]);
  end loop;

  if v_n <= c_spots then
    for i in 1 .. v_n loop
      insert into lineup (match_id, player_id, via) values (p_match, v_ids[i], 'zeker');
    end loop;
  else
    v_th := v_cnts[c_spots];
    for i in 1 .. v_n loop
      if v_cnts[i] < v_th then
        insert into lineup (match_id, player_id, via) values (p_match, v_ids[i], 'zeker');
        v_sure := v_sure + 1;
      elsif v_cnts[i] = v_th then
        v_tied := v_tied || v_ids[i];
      end if;
    end loop;
    v_open := c_spots - v_sure;
    if array_length(v_tied, 1) = v_open then
      for i in 1 .. v_open loop
        insert into lineup (match_id, player_id, via) values (p_match, v_tied[i], 'zeker');
      end loop;
      v_open := 0;
    else
      v_seed := 'PAYIT-FC-' || to_char(v_kick at time zone 'Europe/Brussels', 'YYYYMMDD');
      v_cands := to_jsonb(v_tied);
      for r in 1 .. v_open loop
        v_text := v_seed || case when r > 1 then '#' || r else '' end;
        v_hash := sha256(convert_to(v_text, 'UTF8'));
        v_len := array_length(v_tied, 1);
        v_rest := hash_mod(v_hash, v_len);
        insert into lineup (match_id, player_id, via) values (p_match, v_tied[v_rest + 1], 'loting');
        v_rounds := v_rounds || jsonb_build_object('text', v_text, 'hash', encode(v_hash, 'hex'),
                                                   'n', v_len, 'rest', v_rest, 'pick', v_tied[v_rest + 1]);
        v_tied := v_tied[1:v_rest] || v_tied[v_rest + 2:v_len];
      end loop;
    end if;
  end if;

  update matches
     set finalized_at = now(),
         result = jsonb_build_object('available', v_n, 'too_few', v_n < c_min, 'counts', v_counts,
                                     'spots', v_open, 'candidates', v_cands, 'rounds', v_rounds)
   where id = p_match;
end $$;

-- sluit elke match af waarvan de inschrijving voorbij is (2 dagen voor de aftrap), oudste eerst
create or replace function selectie.finalize_due() returns void
language plpgsql set search_path = selectie, public as $$
declare
  m record;
begin
  for m in select id from matches
            where finalized_at is null and kickoff is not null and deadline(kickoff) <= now()
            order by kickoff, id loop
    perform finalize_match(m.id);
  end loop;
end $$;

/* ------------------------------------------------------------- functies voor de website */

-- namenlijst voor het aanmeldscherm (dezelfde namen als op de ploegpagina)
create or replace function public.sel_roster() returns jsonb
language sql stable security definer set search_path = selectie, public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', first || ' ' || last, 'has_pin', pin_hash is not null)
                            order by sortkey collate "C"), '[]'::jsonb)
    from players where active
$$;

-- aanmelden; wie nog geen pincode heeft, kiest ze bij de eerste aanmelding
create or replace function public.sel_login(p_player int, p_pin text) returns jsonb
language plpgsql security definer set search_path = selectie, public as $$
declare
  v players;
  v_salt text;
  v_token uuid;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then return jsonb_build_object('error', 'PIN_FORMAT'); end if;
  select * into v from players where id = p_player and active for update;
  if not found then return jsonb_build_object('error', 'UNKNOWN_PLAYER'); end if;
  if v.locked_until is not null and v.locked_until > now() then return jsonb_build_object('error', 'LOCKED'); end if;

  if v.pin_hash is null then
    v_salt := gen_random_uuid()::text;
    update players set pin_salt = v_salt, pin_hash = pin_hash(v_salt, p_pin), fails = 0, locked_until = null where id = v.id;
  elsif v.pin_hash <> pin_hash(v.pin_salt, p_pin) then
    if v.fails + 1 >= 5 then
      update players set fails = 0, locked_until = now() + interval '15 minutes' where id = v.id;
      return jsonb_build_object('error', 'LOCKED');
    end if;
    update players set fails = fails + 1 where id = v.id;
    return jsonb_build_object('error', 'WRONG_PIN');
  else
    update players set fails = 0, locked_until = null where id = v.id;
  end if;

  insert into sessions (player_id) values (v.id) returning token into v_token;
  return jsonb_build_object('token', v_token);
end $$;

create or replace function public.sel_logout(p_token text) returns jsonb
language plpgsql security definer set search_path = selectie, public as $$
begin
  delete from sessions where token::text = p_token;
  return '{}'::jsonb;
end $$;

-- alles wat een aangemelde speler ziet
create or replace function public.sel_state(p_token text) returns jsonb
language plpgsql security definer set search_path = selectie, public as $$
declare
  v players;
begin
  v := auth(p_token);
  perform finalize_due();
  return jsonb_build_object(
    'me', jsonb_build_object('id', v.id, 'name', v.first || ' ' || v.last, 'first', v.first, 'admin', v.is_admin),
    'now', now(),
    'spots', 8,
    'min', 5,
    'players', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.first || ' ' || p.last, 'has_pin', p.pin_hash is not null)
                                          order by p.sortkey collate "C"), '[]'::jsonb)
                  from players p where p.active),
    'matches', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', m.id, 'home', m.home, 'away', m.away, 'place', m.place,
                    'kickoff', m.kickoff, 'deadline', deadline(m.kickoff),
                    'final', m.finalized_at is not null, 'selectable', selectable(m.id), 'result', m.result,
                    'yes', (select coalesce(jsonb_agg(a.player_id), '[]'::jsonb) from availability a where a.match_id = m.id and a.status = 'ja'),
                    'no', (select coalesce(jsonb_agg(a.player_id), '[]'::jsonb) from availability a where a.match_id = m.id and a.status = 'nee'),
                    'lineup', (select coalesce(jsonb_agg(jsonb_build_object('id', l.player_id, 'via', l.via)), '[]'::jsonb) from lineup l where l.match_id = m.id)
                  ) order by m.kickoff nulls last, m.id), '[]'::jsonb)
                  from matches m)
  );
end $$;

-- "ik kan" / "ik kan niet" (p_status: 'ja', 'nee' of leeg om te wissen); de beheerder mag dit ook voor een ploegmaat
create or replace function public.sel_set_availability(p_token text, p_match int, p_status text, p_player int default null) returns jsonb
language plpgsql security definer set search_path = selectie, public as $$
declare
  v players;
  m matches;
  v_target int;
begin
  v := auth(p_token);
  v_target := coalesce(p_player, v.id);
  if v_target <> v.id and not v.is_admin then raise exception 'FORBIDDEN'; end if;
  select * into m from matches where id = p_match;
  if not found then raise exception 'UNKNOWN_MATCH'; end if;
  if m.kickoff is null then raise exception 'NO_DATE'; end if;
  if m.finalized_at is not null or deadline(m.kickoff) <= now() then raise exception 'CLOSED'; end if;
  if not selectable(p_match) then raise exception 'TOO_EARLY'; end if;

  if p_status is null then
    delete from availability where match_id = p_match and player_id = v_target;
  elsif p_status in ('ja', 'nee') then
    insert into availability (match_id, player_id, status) values (p_match, v_target, p_status)
    on conflict (match_id, player_id) do update set status = excluded.status, updated_at = now();
  else
    raise exception 'BAD_STATUS';
  end if;
  return sel_state(p_token);
end $$;

-- beheerder: wie effectief meespeelt of meespeelde (bv. na een afzegging)
create or replace function public.sel_admin_lineup(p_token text, p_match int, p_players int[]) returns jsonb
language plpgsql security definer set search_path = selectie, public as $$
declare
  v players;
begin
  v := auth(p_token);
  if not v.is_admin then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from matches where id = p_match and finalized_at is not null) then raise exception 'NOT_CLOSED'; end if;
  delete from lineup where match_id = p_match and not (player_id = any (p_players));
  insert into lineup (match_id, player_id, via)
  select p_match, p.id, 'manueel' from players p where p.id = any (p_players)
  on conflict do nothing;
  return sel_state(p_token);
end $$;

-- beheerder: pincode van een speler wissen, zodat hij een nieuwe kan kiezen
create or replace function public.sel_admin_reset_pin(p_token text, p_player int) returns jsonb
language plpgsql security definer set search_path = selectie, public as $$
declare
  v players;
begin
  v := auth(p_token);
  if not v.is_admin then raise exception 'FORBIDDEN'; end if;
  update players set pin_salt = null, pin_hash = null, fails = 0, locked_until = null where id = p_player;
  delete from sessions where player_id = p_player and token::text <> p_token;
  return sel_state(p_token);
end $$;

-- beheerder: kalender overnemen uit js/data.js (gebeurt vanzelf wanneer de beheerder de pagina opent)
create or replace function public.sel_admin_sync(p_token text, p_matches jsonb) returns jsonb
language plpgsql security definer set search_path = selectie, public as $$
declare
  v players;
  e jsonb;
  v_kick timestamptz;
begin
  v := auth(p_token);
  if not v.is_admin then raise exception 'FORBIDDEN'; end if;
  for e in select * from jsonb_array_elements(p_matches) loop
    v_kick := case when e->>'date' is null or e->>'time' is null then null
                   else ((e->>'date') || ' ' || (e->>'time'))::timestamp at time zone 'Europe/Brussels' end;
    insert into matches (key, home, away, place, kickoff)
    values (e->>'key', e->>'home', e->>'away', e->>'place', v_kick)
    on conflict (key) do update set place = excluded.place, kickoff = excluded.kickoff
      where matches.finalized_at is null;
  end loop;
  return sel_state(p_token);
end $$;

-- alleen de sel_-functies zijn van buitenaf aanroepbaar
revoke all on schema selectie from public;
revoke execute on all functions in schema selectie from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema selectie from anon, authenticated;
    grant execute on function public.sel_roster(), public.sel_login(int, text), public.sel_logout(text), public.sel_state(text),
      public.sel_set_availability(text, int, text, int), public.sel_admin_lineup(text, int, int[]),
      public.sel_admin_reset_pin(text, int), public.sel_admin_sync(text, jsonb) to anon, authenticated;
  end if;
end $$;

/* ------------------------------------------------------------------ startgegevens */

insert into selectie.players (id, first, last, sortkey, is_admin) values
  (1, 'Louis', 'Azou', 'azou louis', false),
  (2, 'Jonas', 'Boucquet', 'boucquet jonas', false),
  (3, 'Artuur', 'Callebert', 'callebert artuur', false),
  (4, 'Arthur', 'De Fauw', 'defauw arthur', false),
  (5, 'Achiel', 'Denijs', 'denijs achiel', false),
  (6, 'Milan', 'Deryckere', 'deryckere milan', false),
  (7, 'Jelle', 'Descheemaecker', 'descheemaecker jelle', false),
  (8, 'Pierre', 'Dubuisson', 'dubuisson pierre', false),
  (9, 'Ilias', 'Godefroo', 'godefroo ilias', false),
  (10, 'Niel', 'Lammertyn', 'lammertyn niel', false),
  (11, 'Mathias', 'Vancompernolle', 'vancompernolle mathias', false),
  (12, 'Jean-Louis', 'Vandewalle', 'vandewalle jean-louis', true),
  (13, 'Rafael', 'Verhamme', 'verhamme rafael', false)
on conflict (id) do nothing;

-- de drie gespeelde matchen, met wie meespeelde
insert into selectie.matches (key, home, away, place, kickoff, finalized_at, result) values
  ('Q-Team|PAYIT FC', 'Q-Team', 'PAYIT FC', 'Izegem', timestamp '2026-09-14 20:55' at time zone 'Europe/Brussels', now(), null),
  ('PAYIT FC|Driemo', 'PAYIT FC', 'Driemo', 'Izegem', timestamp '2026-09-21 20:55' at time zone 'Europe/Brussels', now(), null),
  ('PAYIT FC|De Kasjotters', 'PAYIT FC', 'De Kasjotters', 'Izegem', timestamp '2026-09-28 20:30' at time zone 'Europe/Brussels', now(), null)
on conflict (key) do nothing;

insert into selectie.lineup (match_id, player_id, via)
select m.id, x.pid, 'manueel'
  from (values
    ('Q-Team|PAYIT FC', 12), ('Q-Team|PAYIT FC', 13), ('Q-Team|PAYIT FC', 5), ('Q-Team|PAYIT FC', 4),
    ('Q-Team|PAYIT FC', 2), ('Q-Team|PAYIT FC', 10), ('Q-Team|PAYIT FC', 7), ('Q-Team|PAYIT FC', 6),
    ('PAYIT FC|Driemo', 1), ('PAYIT FC|Driemo', 7), ('PAYIT FC|Driemo', 10), ('PAYIT FC|Driemo', 13),
    ('PAYIT FC|Driemo', 2), ('PAYIT FC|Driemo', 4), ('PAYIT FC|Driemo', 12), ('PAYIT FC|Driemo', 9),
    ('PAYIT FC|De Kasjotters', 2), ('PAYIT FC|De Kasjotters', 1), ('PAYIT FC|De Kasjotters', 13), ('PAYIT FC|De Kasjotters', 4),
    ('PAYIT FC|De Kasjotters', 6), ('PAYIT FC|De Kasjotters', 12), ('PAYIT FC|De Kasjotters', 9), ('PAYIT FC|De Kasjotters', 8)
  ) as x(key, pid)
  join selectie.matches m on m.key = x.key
on conflict do nothing;

-- de komende matchen (nadien houdt de pagina dit zelf gelijk met js/data.js)
insert into selectie.matches (key, home, away, place, kickoff) values
  ('PAYIT FC|FC de Ondank', 'PAYIT FC', 'FC de Ondank', 'Izegem', null),
  ('Checked by Vanhulle|PAYIT FC', 'Checked by Vanhulle', 'PAYIT FC', 'Kachtem', timestamp '2026-10-14 21:00' at time zone 'Europe/Brussels'),
  ('PAYIT FC|T''Schroefke', 'PAYIT FC', 'T''Schroefke', 'Zie MVBI', timestamp '2026-10-22 19:00' at time zone 'Europe/Brussels'),
  ('Panna FC|PAYIT FC', 'Panna FC', 'PAYIT FC', 'Izegem', timestamp '2026-10-26 19:30' at time zone 'Europe/Brussels'),
  ('PAYIT FC|L''Abattoir', 'PAYIT FC', 'L''Abattoir', 'Izegem', timestamp '2026-11-09 19:30' at time zone 'Europe/Brussels'),
  ('Lagaar Gworks|PAYIT FC', 'Lagaar Gworks', 'PAYIT FC', 'Kachtem', timestamp '2026-11-18 19:00' at time zone 'Europe/Brussels'),
  ('Bloemgat|PAYIT FC', 'Bloemgat', 'PAYIT FC', 'Kachtem', timestamp '2026-11-25 19:00' at time zone 'Europe/Brussels'),
  ('Playa|PAYIT FC', 'Playa', 'PAYIT FC', 'Izegem', timestamp '2026-12-07 19:30' at time zone 'Europe/Brussels'),
  ('PAYIT FC|Sanifro ofzo', 'PAYIT FC', 'Sanifro ofzo', 'Izegem', timestamp '2026-12-14 20:30' at time zone 'Europe/Brussels')
on conflict (key) do nothing;
