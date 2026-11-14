-- Google data page (date ranges, Search Console AI) and consultation booking. Run once in the Supabase SQL editor,
-- after 0012, before deploying the code that goes with it.

-- Google cache: 7- and 90-day windows are cached next to the 28-day one ('gsc_7', 'gsc_90', ...), and 'gsc_ai'
-- holds the AI's written insights on Search Console (made on request, kept 24 hours).
alter table public.google_cache drop constraint if exists google_cache_source_check;
alter table public.google_cache add constraint google_cache_source_check check (source in (
  'gsc', 'gsc_7', 'gsc_90', 'gsc_ai',
  'ga4', 'ga4_7', 'ga4_90', 'ga4_ai',
  'ads', 'ads_7', 'ads_90', 'ads_ai'
));

-- Consultation booking: weekly hours, blocked dates and the bookings themselves. RLS on with no policies, so only
-- the server's service-role key reads or writes them (visitors book through /api/booking; admins manage in /admin).
create table if not exists public.booking_settings (
  id          int primary key default 1 check (id = 1),
  timezone    text not null default 'Asia/Kolkata',
  -- One entry per weekday (0 = Sunday): {"0": [["09:00","22:00"]], ...}. Every day 9:00 to 22:00 to start with.
  hours       jsonb not null default '{"0":[["09:00","22:00"]],"1":[["09:00","22:00"]],"2":[["09:00","22:00"]],"3":[["09:00","22:00"]],"4":[["09:00","22:00"]],"5":[["09:00","22:00"]],"6":[["09:00","22:00"]]}',
  notice_hours int not null default 24 check (notice_hours between 0 and 336),
  horizon_days int not null default 30 check (horizon_days between 1 and 120),
  buffer_min  int not null default 15 check (buffer_min between 0 and 120),
  updated_at  timestamptz not null default now()
);
insert into public.booking_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.booking_blocks (
  day        date primary key,
  note       text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  minutes     int not null check (minutes in (30, 60, 90)),
  session     text not null check (char_length(session) <= 120),
  name        text not null check (char_length(name) between 1 and 100),
  email       text not null check (char_length(email) between 3 and 254),
  website     text check (char_length(website) <= 300),
  message     text check (char_length(message) <= 3000),
  timezone    text check (char_length(timezone) <= 64),
  user_id     uuid,
  status      text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'done')),
  meet_url    text check (char_length(meet_url) <= 300),
  manage_token text not null check (char_length(manage_token) between 24 and 64),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists bookings_starts_idx on public.bookings (starts_at);
-- Two confirmed bookings can never start at the same moment (the API also checks overlaps with the buffer).
create unique index if not exists bookings_one_per_start on public.bookings (starts_at) where status = 'confirmed';

alter table public.booking_settings enable row level security;
alter table public.booking_blocks enable row level security;
alter table public.bookings enable row level security;
