-- Consultation requests and contact messages from the website forms. Run once in the Supabase SQL editor,
-- after 0001 to 0007. RLS is on with no policies, so only the server's service-role key can read or write
-- this table: visitors submit through /api/request, and admins read it in the /admin panel.
create table if not exists public.requests (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('consultation', 'contact')),
  name           text not null check (char_length(name) between 1 and 100),
  email          text not null check (char_length(email) between 3 and 254),
  website        text check (char_length(website) <= 300),
  session        text check (char_length(session) <= 120),
  preferred_time text check (char_length(preferred_time) <= 120),
  message        text check (char_length(message) <= 3000),
  status         text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'closed')),
  user_id        uuid,
  created_at     timestamptz not null default now()
);
create index if not exists requests_created_idx on public.requests (created_at desc);
alter table public.requests enable row level security;
