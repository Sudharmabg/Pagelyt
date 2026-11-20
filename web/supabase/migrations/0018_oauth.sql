-- Google and GitHub sign-in (app/api/auth/oauth). Supabase links a Google or GitHub sign-in to an existing account
-- with the exact same email itself; this catches the other spellings of one inbox (name+tag@gmail.com,
-- n.ame@gmail.com) so a provider sign-in can't open a second account for an inbox that already has one.
-- Run in the Supabase SQL editor after 0017. Needs canonical_email() from 0009.

create or replace function public.inbox_has_other_account(p_email text, p_user uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1 from auth.users
    where id <> p_user and public.canonical_email(email) = public.canonical_email(p_email)
  );
$$;
revoke all on function public.inbox_has_other_account(text, uuid) from public, anon, authenticated;
grant execute on function public.inbox_has_other_account(text, uuid) to service_role;

-- Settings to change in the Supabase dashboard (not SQL), see DEPLOY.md "Google and GitHub sign-in":
--   Authentication > Sign In / Providers: enable Google and GitHub with their client ID and secret.
--   Authentication > URL Configuration > Redirect URLs: add https://YOUR-DOMAIN/auth/callback.
