-- One owner per website, email-code sign-up and no phone numbers. Run once in the Supabase SQL editor, after 0001
-- to 0008, and BEFORE deploying the code that goes with it (the new code no longer sends a phone number).
-- Both tables have RLS on with no policies, so only the server's service-role key can read or write them.

-- Who owns each website. `domain` is the registrable root domain (example.com covers www.example.com,
-- blog.example.com and every path), worked out on the server with the public-suffix list.
-- An unverified owner (a new sign-up that has not entered its email code yet) only holds the domain for
-- 24 hours; after that anyone may claim it. Existing saved sites are copied in lazily the first time a domain
-- is looked up, so there is nothing to backfill here.
create table if not exists public.site_owners (
  domain     text primary key check (char_length(domain) between 3 and 253),
  user_id    uuid not null references auth.users(id) on delete cascade,
  verified   boolean not null default false,
  claimed_at timestamptz not null default now()
);
create index if not exists site_owners_user on public.site_owners (user_id);
alter table public.site_owners enable row level security;

-- Proof-of-ownership challenges: someone who really owns a domain registered to another account adds this token
-- to their homepage (meta tag) or DNS (TXT record) and the domain moves to them.
create table if not exists public.site_claims (
  domain     text not null check (char_length(domain) between 3 and 253),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null check (char_length(token) between 16 and 64),
  created_at timestamptz not null default now(),
  primary key (domain, user_id)
);
alter table public.site_claims enable row level security;

-- Has this account confirmed its email? Used to keep a new sign-up's dashboard locked until it enters its code.
create or replace function public.email_confirmed(p_user uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select coalesce((select email_confirmed_at is not null from auth.users where id = p_user), false);
$$;
revoke all on function public.email_confirmed(uuid) from public, anon, authenticated;
grant execute on function public.email_confirmed(uuid) to service_role;

-- One inbox, one account: Gmail ignores dots and "+tags", and most providers ignore "+tags".
create or replace function public.canonical_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when split_part(lower(p_email), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(p_email), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else split_part(split_part(lower(p_email), '@', 1), '+', 1) || '@' || split_part(lower(p_email), '@', 2)
  end;
$$;

create or replace function public.inbox_has_account(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (select 1 from auth.users where public.canonical_email(email) = public.canonical_email(p_email));
$$;
revoke all on function public.inbox_has_account(text) from public, anon, authenticated;
grant execute on function public.inbox_has_account(text) to service_role;

-- Phone numbers are no longer collected. Remove the ones already stored.
alter table public.leads drop column if exists phone;

-- Settings to change in the Supabase dashboard (not SQL), see DEPLOY.md:
--   Authentication > Email Templates > Confirm signup: show the 6-digit {{ .Token }} instead of the link.
--   Authentication > Sign In / Providers > Email: Email OTP length 6.
