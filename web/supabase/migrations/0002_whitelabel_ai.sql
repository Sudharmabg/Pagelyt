-- White-label reports and AI visibility tracking. Run after 0001_init.sql.

-- ------------------------------------------------------------------ plans
-- Only the service role can change a plan (Razorpay webhook later); users can read their own.
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  plan       text not null default 'free' check (plan in ('free','essential','professional','business')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profiles_owner_read on public.profiles for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------ brands (white-label identity)
create table if not exists public.brands (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  logo_url         text check (logo_url is null or logo_url ~ '^https://'),
  color            text not null default '#6a30bd' check (color ~ '^#[0-9a-fA-F]{6}$'),
  website          text,
  contact_email    text,
  footer           text check (footer is null or char_length(footer) <= 300),
  show_powered_by  boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists brands_user on public.brands (user_id);
alter table public.brands enable row level security;
create policy brands_owner_all on public.brands for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------ shared (client-facing) reports
-- Created by the server after it checks ownership and plan. The token is the secret in the link.
create table if not exists public.shared_reports (
  token         text primary key,
  scan_id       text not null references public.scans(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  brand_id      uuid references public.brands(id) on delete set null,
  show_details  boolean not null default true,
  include_ai    boolean not null default false,
  revoked       boolean not null default false,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists shared_reports_user on public.shared_reports (user_id, created_at desc);
alter table public.shared_reports enable row level security;
create policy shared_owner_read   on public.shared_reports for select to authenticated using (user_id = auth.uid());
create policy shared_owner_update on public.shared_reports for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shared_owner_delete on public.shared_reports for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------ AI visibility
alter table public.sites
  add column if not exists brand_terms     text[] not null default '{}',
  add column if not exists competitors     text[] not null default '{}',
  add column if not exists ai_track        boolean not null default false,
  add column if not exists ai_next_run_at  timestamptz;
create index if not exists sites_ai_due on public.sites (ai_next_run_at) where ai_track;

create table if not exists public.ai_prompts (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references public.sites(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  prompt     text not null check (char_length(prompt) between 5 and 300),
  created_at timestamptz not null default now()
);
create index if not exists ai_prompts_site on public.ai_prompts (site_id);
alter table public.ai_prompts enable row level security;
create policy ai_prompts_owner_all on public.ai_prompts for all to authenticated
  using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));

create table if not exists public.ai_runs (
  id                 bigint generated always as identity primary key,
  site_id            uuid not null references public.sites(id) on delete cascade,
  prompt_id          uuid not null references public.ai_prompts(id) on delete cascade,
  provider           text not null,
  at                 timestamptz not null default now(),
  mentioned          boolean not null,
  cited              boolean not null,
  position           int,                         -- 1 = named first among brand + competitors
  competitor_counts  jsonb not null default '{}'::jsonb,
  answer             text,
  citations          jsonb not null default '[]'::jsonb,
  error              text
);
create index if not exists ai_runs_site_at on public.ai_runs (site_id, at desc);
alter table public.ai_runs enable row level security;
create policy ai_runs_owner_read on public.ai_runs for select to authenticated
  using (exists (select 1 from public.sites s where s.id = site_id and s.user_id = auth.uid()));
-- inserts come from the server with the service role only.
