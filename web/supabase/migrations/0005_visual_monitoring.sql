-- Visual change monitoring: one Lighthouse screenshot per scan, kept apart from `scans` so that
-- ordinary report reads stay small. Run once in the Supabase SQL editor, after 0001 to 0004.

create table if not exists public.scan_shots (
  scan_id text primary key references public.scans (id) on delete cascade,
  data text not null,                 -- data:image/jpeg;base64,... (roughly 30-120 KB)
  created_at timestamptz not null default now()
);

-- Server only (service role). The browser's anon key cannot read or write it.
alter table public.scan_shots enable row level security;
