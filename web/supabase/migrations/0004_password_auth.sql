-- Password sign-in, owner-only editing and saved progress.
-- Run once in the Supabase SQL editor, after 0001 to 0003.

-- Findings the owner has marked as fixed, saved with the report so they follow the owner to any device.
alter table public.scans add column if not exists fixed jsonb not null default '[]'::jsonb;

-- Look leads up by scan (used when a verified email claims the scans it started).
create index if not exists leads_scan on public.leads (scan_id);

-- "Does an account exist for this email?" Used only by the server's rate-limited email-check endpoint.
-- It reads auth.users, so it is locked to the service role: the browser can never call it.
create or replace function public.account_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (select 1 from auth.users where lower(email) = lower(p_email));
$$;
revoke all on function public.account_exists(text) from public, anon, authenticated;
grant execute on function public.account_exists(text) to service_role;

-- Settings to apply in the Supabase dashboard (not SQL):
--   Authentication > Sign In / Providers > Email: keep "Confirm email" ON, set minimum password length to 8.
--   Authentication > SMTP Settings: custom SMTP through Resend (see DEPLOY.md).
--   Authentication > URL Configuration: Site URL and the redirect URLs listed in DEPLOY.md.
