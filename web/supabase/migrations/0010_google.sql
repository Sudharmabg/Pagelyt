-- Google integrations (Search Console now; Analytics and Ads later). Run once in the Supabase SQL editor, after
-- 0001 to 0009, before deploying the code that goes with it. RLS is on with no policies, so only the server's
-- service-role key can read or write these tables; the browser never sees a token.

-- One Google connection per Pagelyt account. The refresh token is encrypted on the server (AES-GCM, key in the
-- GOOGLE_TOKEN_KEY secret) before it is stored; access tokens are never stored. `scopes` is what Google granted,
-- which grows as the person connects more products (incremental consent).
create table if not exists public.google_connections (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  google_email      text,
  scopes            text[] not null default '{}',
  refresh_token_enc text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.google_connections enable row level security;

-- Which Google property belongs to each saved site. `gsc_property` is a Search Console site URL such as
-- "sc-domain:example.com" or "https://www.example.com/".
create table if not exists public.google_links (
  site_id      uuid primary key references public.sites(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  gsc_property text,
  updated_at   timestamptz not null default now()
);
create index if not exists google_links_user on public.google_links (user_id);
alter table public.google_links enable row level security;

-- The last data fetched from Google, per site and source ('gsc'). The dashboard reads this and refreshes it when it
-- is older than 24 hours (there is no cron job).
create table if not exists public.google_cache (
  site_id    uuid not null references public.sites(id) on delete cascade,
  source     text not null check (source in ('gsc', 'ga4', 'ads')),
  data       jsonb,
  error      text,
  fetched_at timestamptz not null default now(),
  primary key (site_id, source)
);
alter table public.google_cache enable row level security;
