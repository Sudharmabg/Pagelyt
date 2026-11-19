-- Freelance enquiries from the "Work with me" modal signed-in people see once per sign-in.
-- Run once in the Supabase SQL editor, after 0016. They live in `requests` (kind 'freelance', the chosen
-- service in `session`), so the admin Requests tab shows them next to consultations and messages.
alter table public.requests drop constraint if exists requests_kind_check;
alter table public.requests add constraint requests_kind_check check (kind in ('consultation', 'contact', 'freelance'));
