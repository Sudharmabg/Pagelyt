-- Admin scans made to share with someone. Run once in the Supabase SQL editor, after 0001 to 0013.
-- An admin scans a website from /admin (Scan tab) and sends the link. Until somebody signs in through that link the
-- report shows only its scores; the first person to sign in becomes its owner (scans.user_id) and it then behaves
-- like any other report. Server only: these columns are written with the service-role key.
alter table public.scans add column if not exists invite     boolean not null default false; -- made from the admin Scan tab
alter table public.scans add column if not exists invited_by uuid references auth.users(id) on delete set null; -- the admin
alter table public.scans add column if not exists opened_at  timestamptz; -- first time the link was opened by a non-admin
alter table public.scans add column if not exists claimed_at timestamptz; -- when somebody signed in and took the report
create index if not exists scans_invite on public.scans (created_at desc) where invite;
