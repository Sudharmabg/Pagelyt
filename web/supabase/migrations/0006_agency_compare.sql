-- Agency onboarding and competitor comparisons. Run once in the Supabase SQL editor, after 0001 to 0005.

-- "Are you an agency?" answer from the post-scan modal. null = not asked yet.
alter table public.profiles
  add column if not exists account_type text check (account_type in ('agency', 'owner'));

-- Side-by-side comparison of one of the user's reports against up to three competitor reports.
-- Server only (service role); the id is the unguessable secret in the /compare/<id> link.
create table if not exists public.comparisons (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  scan_id     text not null references public.scans (id) on delete cascade,
  rival_ids   text[] not null check (cardinality(rival_ids) between 1 and 3),
  created_at  timestamptz not null default now()
);
create index if not exists comparisons_user on public.comparisons (user_id, created_at desc);
alter table public.comparisons enable row level security;
