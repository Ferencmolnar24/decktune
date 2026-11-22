-- DeckTune player reports on Supabase (free plan). Paste all of this into the project's
-- SQL Editor and press Run, once. Running it again is safe.
--
-- Visitors can read visible reports, post new ones and vote "helpful"; nothing else. Every field is
-- checked here, a visitor can post at most 3 reports per 10 minutes, and the whole site at most 60
-- an hour. To moderate: Table Editor → reports → set `hidden` to true (or delete the row).

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

create index if not exists reports_recent on public.reports (created_at desc);
create index if not exists reports_ip on public.reports (ip_hash, created_at desc);

create table if not exists public.report_votes (
  report_id  bigint not null references public.reports (id) on delete cascade,
  ip_hash    text   not null,
  created_at timestamptz not null default now(),
  primary key (report_id, ip_hash)
);

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

-- Before each new report: rate limits, and fields a visitor doesn't get to choose.
create or replace function public.reports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.ip_hash := visitor_hash();
  new.created_at := now();
  new.helpful := 0;
  new.hidden := false;
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

-- What visitors (the "anon" role the site uses) may do.
alter table public.reports enable row level security;
alter table public.report_votes enable row level security;
alter table public.app_secrets enable row level security;

drop policy if exists "visible reports" on public.reports;
create policy "visible reports" on public.reports for select to anon, authenticated using (not hidden);
drop policy if exists "post a report" on public.reports;
create policy "post a report" on public.reports for insert to anon, authenticated with check (true);

revoke all on public.reports, public.report_votes, public.app_secrets from anon, authenticated;
grant select (id, created_at, app_id, game, device, os, rating, fps, battery, preset, settings, notes, name, helpful, hidden)
  on public.reports to anon, authenticated;
grant insert (app_id, game, device, os, rating, fps, battery, preset, settings, notes, name)
  on public.reports to anon, authenticated;

revoke all on function public.visitor_hash(), public.reports_guard() from public, anon, authenticated;
revoke all on function public.vote_helpful(bigint) from public;
grant execute on function public.vote_helpful(bigint) to anon, authenticated;
