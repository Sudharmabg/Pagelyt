-- Saved Ask Pagelyt conversations. Run once in the Supabase SQL editor, after 0001 to 0014.
-- One thread per conversation, kept per website (host) so it outlives rescans; the dashboard's History list shows the
-- owner's threads for that site. Both tables have RLS on with no policies: only the server (service-role key) reads or
-- writes them, after checking the signed-in user owns the report.
create table if not exists public.chat_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  host       text not null check (char_length(host) between 1 and 253),
  scan_id    text,                                                     -- the report the chat was last used with
  title      text not null default 'New chat' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_threads_user_host on public.chat_threads (user_id, host, updated_at desc);
alter table public.chat_threads enable row level security;

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.chat_threads(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null check (char_length(content) <= 20000),
  sources    jsonb not null default '[]'::jsonb,                      -- [{ title, url }] the answer drew on
  finding    text check (char_length(finding) <= 300),               -- the report finding a question was about
  feedback   smallint check (feedback in (-1, 1)),                   -- thumbs up (1) or down (-1) on an answer
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread on public.chat_messages (thread_id, created_at);
create index if not exists chat_messages_feedback on public.chat_messages (created_at desc) where feedback is not null;
alter table public.chat_messages enable row level security;
