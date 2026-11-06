-- Pagelyt schema. Run in the Supabase SQL editor, or with `supabase db push`.
-- Server code uses the service-role key (bypasses RLS). The browser only ever has the anon key,
-- so every table below has RLS on and grants access only to the signed-in owner of a row.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ scans
create table if not exists public.scans (
  id          text primary key,
  url         text not null,
  host        text not null,
  status      text not null default 'running' check (status in ('running','done','failed')),
  stage       int  not null default 0,
  state       jsonb not null default '{}'::jsonb,   -- partial results between stages
  result      jsonb,                                  -- final report once status = 'done'
  error       text,
  user_id     uuid references auth.users(id) on delete set null,
  site_id     uuid,
  created_at  timestamptz not null default now()
);
create index if not exists scans_host_created on public.scans (host, created_at desc);
create index if not exists scans_user_created on public.scans (user_id, created_at desc);

-- ------------------------------------------------------------------ leads (server only)
create table if not exists public.leads (
  id         bigint generated always as identity primary key,
  scan_id    text not null,
  name       text not null,
  email      text not null,
  phone      text not null,
  host       text not null,
  created_at timestamptz not null default now()
);
create index if not exists leads_email on public.leads (email);

-- ------------------------------------------------------------------ sites (saved by a signed-in user)
create table if not exists public.sites (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  host         text not null,
  url          text not null,
  cadence      text not null default 'none' check (cadence in ('none','daily','weekly','monthly')),
  uptime       boolean not null default false,
  last_scan_id text,
  next_run_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, host)
);
create index if not exists sites_due on public.sites (next_run_at) where cadence <> 'none';

alter table public.scans add constraint scans_site_fk foreign key (site_id) references public.sites(id) on delete set null;

-- ------------------------------------------------------------------ uptime checks
create table if not exists public.uptime_checks (
  id       bigint generated always as identity primary key,
  site_id  uuid not null references public.sites(id) on delete cascade,
  at       timestamptz not null default now(),
  ok       boolean not null,
  status   int,
  ms       int
);
create index if not exists uptime_site_at on public.uptime_checks (site_id, at desc);

-- ------------------------------------------------------------------ rate limiting
create table if not exists public.rate_limits (
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists rate_limits_key_at on public.rate_limits (key, at desc);

create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.rate_limits where at < now() - interval '1 day';
  select count(*) into n from public.rate_limits
    where key = p_key and at > now() - make_interval(secs => p_window_seconds);
  if n >= p_limit then return false; end if;
  insert into public.rate_limits (key) values (p_key);
  return true;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;

-- ------------------------------------------------------------------ row-level security
alter table public.scans         enable row level security;
alter table public.leads         enable row level security;
alter table public.sites         enable row level security;
alter table public.uptime_checks enable row level security;
alter table public.rate_limits   enable row level security;

-- scans: an owner can read their own (anonymous reports are served by the server, not the browser)
create policy scans_owner_read on public.scans for select to authenticated using (user_id = auth.uid());

-- sites: full control of your own
create policy sites_owner_all on public.sites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- uptime: read checks for your own sites
create policy uptime_owner_read on public.uptime_checks for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));

-- leads and rate_limits: no policies at all, so only the service role can touch them.
