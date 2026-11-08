-- Admin panel access. Run once in the Supabase SQL editor, after 0001 to 0006.
-- Who may open /admin. Sign-in still goes through Supabase Auth (passwords stay hashed there); this table
-- only says which verified email addresses are admins. RLS is on with no policies, so only the server's
-- service-role key can read or change it: the browser cannot see or add admins.
create table if not exists public.admins (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- To add an admin:
--   1. Authentication > Users > Add user (tick "Auto Confirm User"), or sign up on the site and confirm the email.
--   2. insert into public.admins (email) values ('you@example.com');   -- lower case
-- To remove one:  delete from public.admins where email = 'you@example.com';
