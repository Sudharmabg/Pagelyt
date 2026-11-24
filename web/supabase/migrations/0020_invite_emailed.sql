-- Who an admin emailed a shared scan's link to. Run once in the Supabase SQL editor, after 0014.
-- Written by the admin Scan tab (Send report) with the service-role key. Sending works without it; the
-- "Sent to" column in the Shared scans table just stays empty until this has been run.
alter table public.scans add column if not exists emailed_to text;
alter table public.scans add column if not exists emailed_at timestamptz;
