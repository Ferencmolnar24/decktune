-- DeckTune player reports on Supabase (free plan). Paste all of this into the project's
-- SQL Editor and press Run. Running it again is safe, and is how an older setup gets the newer
-- parts (edit keys, flags, preset feedback).
--
-- Visitors can read visible reports, post new ones, vote "helpful", flag a report, rate a preset,
-- and edit or delete a report only from the browser that posted it. Nothing else. Every field is
-- checked here, a visitor can post at most 3 reports per 10 minutes, and the whole site at most 60
-- an hour.
--
-- Moderating:
--   Table Editor → reports → set `hidden` to true (or delete the row).
--   A report flagged by 3 different visitors hides itself: filter `hidden` = true to review them;
--   to put one back, set `hidden` to false and `flags` to 0.
--   Table Editor → preset_scores lists presets players said didn't work (most "down" first).

create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  app_id      integer     not null check (app_id between 1 and 99999999),
  game        text        not null check (char_length(game) between 1 and 120),
  device      text        not null check (device in ('lcd', 'oled', 'ally', 'allyz1', 'allyx', 'xally', 'xallyx')),
  os          text        not null check (os in ('SteamOS', 'Windows', 'Bazzite or another Linux')),
  rating      text        not null check (rating in ('great', 'good', 'playable', 'rough', 'unplayable')),
  fps         smallint    not null check (fps in (25, 30, 40, 45, 60, 90, 120)),
  battery     real                 check (battery is null or battery in (1, 1.5, 2, 2.5, 3, 4, 5, 6)),
  preset      text                 check (preset is null or preset in ('Max Battery', 'Optimal', 'Max Performance', 'My own settings')),
  settings    jsonb       not null default '{}'::jsonb check (
                jsonb_typeof(settings) = 'object'
                and char_length(settings::text) <= 1200
                and (settings - array['mode', 'tdp', 'cap', 'refresh', 'gpu', 'resolution', 'upscaling', 'graphics', 'proton', 'other']) = '{}'::jsonb),
  notes       text        not null default '' check (char_length(notes) <= 1500),
  name        text        not null default 'Guest' check (char_length(name) between 1 and 40),
  helpful     integer     not null default 0,
  hidden      boolean     not null default false,
  -- A one-way hash of the poster's address, only for the rate limit. Never readable by visitors.
  ip_hash     text
);

-- Added later; `add column if not exists` brings an older table up to date.
-- The SHA-256 of a random key that only the posting browser holds: it alone can edit or delete.
alter table public.reports add column if not exists edit_key_hash text;
alter table public.reports add column if not exists edited_at timestamptz;
-- Visitors who flagged it; at 3 the report hides itself until it's checked.
alter table public.reports add column if not exists flags integer not null default 0;

create index if not exists reports_recent on public.reports (created_at desc);
create index if not exists reports_ip on public.reports (ip_hash, created_at desc);

create table if not exists public.report_votes (
  report_id  bigint not null references public.reports (id) on delete cascade,
  ip_hash    text   not null,
  created_at timestamptz not null default now(),
  primary key (report_id, ip_hash)
);

create table if not exists public.report_flags (
  report_id  bigint not null references public.reports (id) on delete cascade,
  ip_hash    text   not null,
  created_at timestamptz not null default now(),
  primary key (report_id, ip_hash)
);
create index if not exists report_flags_ip on public.report_flags (ip_hash, created_at desc);

-- "Did this preset work for you?": one answer per visitor per game, handheld and preset.
create table if not exists public.preset_votes (
  app_id     integer not null check (app_id between 1 and 99999999),
  device     text    not null check (device in ('lcd', 'oled', 'ally', 'allyz1', 'allyx', 'xally', 'xallyx')),
  preset     text    not null check (preset in ('MaxBattery', 'Optimal', 'MaxPerformance')),
  ip_hash    text    not null,
  worked     boolean not null,
  created_at timestamptz not null default now(),
  primary key (app_id, device, preset, ip_hash)
);
create index if not exists preset_votes_ip on public.preset_votes (ip_hash, created_at desc);

-- The visitor's address as Supabase's gateway passes it, hashed with this project's own secret salt.
create table if not exists public.app_secrets (name text primary key, value text not null);
insert into public.app_secrets (name, value) values ('ip_salt', md5(random()::text || clock_timestamp()::text))
  on conflict (name) do nothing;

create or replace function public.visitor_hash() returns text
language plpgsql stable security definer set search_path = public as $$
declare
  headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ip text := coalesce(headers ->> 'cf-connecting-ip', split_part(headers ->> 'x-forwarded-for', ',', 1), 'unknown');
begin
  return md5(trim(ip) || (select value from app_secrets where name = 'ip_salt'));
end $$;

create or replace function public.sha256_hex(t text) returns text
language sql immutable as $$ select encode(sha256(convert_to(coalesce(t, ''), 'UTF8')), 'hex') $$;

-- Before each new report: rate limits, and fields a visitor doesn't get to choose.
create or replace function public.reports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.ip_hash := visitor_hash();
  new.created_at := now();
  new.helpful := 0;
  new.hidden := false;
  new.flags := 0;
  new.edited_at := null;
  if new.edit_key_hash is not null and new.edit_key_hash !~ '^[0-9a-f]{64}$' then
    new.edit_key_hash := null;
  end if;
  new.name := coalesce(nullif(btrim(regexp_replace(new.name, '\s+', ' ', 'g')), ''), 'Guest');
  if (select count(*) from reports where ip_hash = new.ip_hash and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'You''ve posted several reports in a row. Wait a few minutes, then try again.';
  end if;
  if (select count(*) from reports where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'DeckTune is getting a lot of reports right now. Try again in a little while.';
  end if;
  return new;
end $$;

drop trigger if exists reports_guard on public.reports;
create trigger reports_guard before insert on public.reports for each row execute function public.reports_guard();

-- One "helpful" vote per visitor per report.
create or replace function public.vote_helpful(report_id bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare
  total integer;
begin
  if not exists (select 1 from reports r where r.id = report_id and not r.hidden) then
    raise exception 'That report is no longer available.';
  end if;
  insert into report_votes (report_id, ip_hash) values (vote_helpful.report_id, visitor_hash())
    on conflict do nothing;
  if found then
    update reports r set helpful = r.helpful + 1 where r.id = vote_helpful.report_id returning r.helpful into total;
  else
    select r.helpful into total from reports r where r.id = vote_helpful.report_id;
  end if;
  return total;
end $$;

-- Changing a report needs the key its browser was given when it was posted. The game stays the
-- same; every other answer can change, under the same checks as a new report.
create or replace function public.edit_report(report_id bigint, edit_key text, changes jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(changes) is distinct from 'object' then
    raise exception 'DeckTune couldn''t save this report. Check the answers and try again.';
  end if;
  update reports r set
    device   = changes ->> 'device',
    os       = changes ->> 'os',
    rating   = changes ->> 'rating',
    fps      = (changes ->> 'fps')::smallint,
    battery  = (changes ->> 'battery')::real,
    preset   = nullif(changes ->> 'preset', ''),
    settings = coalesce(changes -> 'settings', '{}'::jsonb),
    notes    = coalesce(changes ->> 'notes', ''),
    name     = coalesce(nullif(btrim(regexp_replace(coalesce(changes ->> 'name', ''), '\s+', ' ', 'g')), ''), 'Guest'),
    edited_at = now()
  where r.id = edit_report.report_id
    and r.edit_key_hash is not null
    and r.edit_key_hash = sha256_hex(edit_report.edit_key);
  if not found then
    raise exception 'This report can only be changed from the browser that posted it.';
  end if;
end $$;

create or replace function public.delete_report(report_id bigint, edit_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from reports r
  where r.id = delete_report.report_id
    and r.edit_key_hash is not null
    and r.edit_key_hash = sha256_hex(delete_report.edit_key);
  if not found then
    raise exception 'This report can only be deleted from the browser that posted it.';
  end if;
end $$;

-- A flag per visitor per report; the third one hides the report. Returns whether it's now hidden.
create or replace function public.flag_report(report_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me text := visitor_hash();
  now_hidden boolean;
begin
  if not exists (select 1 from reports r where r.id = flag_report.report_id and not r.hidden) then
    return true;
  end if;
  if (select count(*) from report_flags f where f.ip_hash = me and f.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You''ve flagged a lot of reports. Try again later.';
  end if;
  insert into report_flags (report_id, ip_hash) values (flag_report.report_id, me) on conflict do nothing;
  if found then
    update reports r set flags = r.flags + 1, hidden = r.hidden or r.flags + 1 >= 3
      where r.id = flag_report.report_id returning r.hidden into now_hidden;
  else
    select r.hidden into now_hidden from reports r where r.id = flag_report.report_id;
  end if;
  return now_hidden;
end $$;

-- Every preset's tally for one game.
create or replace function public.preset_feedback(p_app_id integer)
returns table (device text, preset text, up integer, down integer)
language sql stable security definer set search_path = public as $$
  select v.device, v.preset, (count(*) filter (where v.worked))::integer, (count(*) filter (where not v.worked))::integer
  from preset_votes v where v.app_id = p_app_id group by v.device, v.preset
$$;

-- Records (or, with p_worked null, takes back) this visitor's answer, then returns the game's tally.
create or replace function public.vote_preset(p_app_id integer, p_device text, p_preset text, p_worked boolean)
returns table (device text, preset text, up integer, down integer)
language plpgsql security definer set search_path = public as $$
declare
  me text := visitor_hash();
begin
  if p_worked is null then
    delete from preset_votes v where v.app_id = p_app_id and v.device = p_device and v.preset = p_preset and v.ip_hash = me;
  else
    if (select count(*) from preset_votes v where v.ip_hash = me and v.created_at > now() - interval '1 hour') >= 60 then
      raise exception 'You''ve rated a lot of presets. Try again later.';
    end if;
    insert into preset_votes (app_id, device, preset, ip_hash, worked) values (p_app_id, p_device, p_preset, me, p_worked)
      on conflict on constraint preset_votes_pkey do update set worked = excluded.worked, created_at = now();
  end if;
  return query select * from preset_feedback(p_app_id);
end $$;

-- For you, in the Table Editor: which presets players say didn't work.
create or replace view public.preset_scores with (security_invoker = on) as
  select app_id, device, preset,
         count(*) filter (where worked) as up,
         count(*) filter (where not worked) as down,
         'https://ferencmolnar24.github.io/decktune/#/game/' || app_id as page
  from public.preset_votes group by app_id, device, preset
  order by down desc, up asc;

-- What visitors (the "anon" role the site uses) may do.
alter table public.reports enable row level security;
alter table public.report_votes enable row level security;
alter table public.report_flags enable row level security;
alter table public.preset_votes enable row level security;
alter table public.app_secrets enable row level security;

drop policy if exists "visible reports" on public.reports;
create policy "visible reports" on public.reports for select to anon, authenticated using (not hidden);
drop policy if exists "post a report" on public.reports;
create policy "post a report" on public.reports for insert to anon, authenticated with check (true);

revoke all on public.reports, public.report_votes, public.report_flags, public.preset_votes, public.app_secrets, public.preset_scores
  from anon, authenticated;
grant select (id, created_at, app_id, game, device, os, rating, fps, battery, preset, settings, notes, name, helpful, hidden, edited_at)
  on public.reports to anon, authenticated;
grant insert (app_id, game, device, os, rating, fps, battery, preset, settings, notes, name, edit_key_hash)
  on public.reports to anon, authenticated;

revoke all on function public.visitor_hash(), public.reports_guard(), public.sha256_hex(text) from public, anon, authenticated;
revoke all on function public.vote_helpful(bigint), public.edit_report(bigint, text, jsonb), public.delete_report(bigint, text),
  public.flag_report(bigint), public.preset_feedback(integer), public.vote_preset(integer, text, text, boolean) from public;
grant execute on function public.vote_helpful(bigint), public.edit_report(bigint, text, jsonb), public.delete_report(bigint, text),
  public.flag_report(bigint), public.preset_feedback(integer), public.vote_preset(integer, text, text, boolean) to anon, authenticated;
