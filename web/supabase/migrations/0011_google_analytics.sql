-- Google Analytics (GA4) for the Google integrations. Run once in the Supabase SQL editor, after 0010, before
-- deploying the code that goes with it.

-- The GA4 property linked to each saved site, as "properties/123456789", and its display name.
alter table public.google_links add column if not exists ga4_property text;
alter table public.google_links add column if not exists ga4_name text;

-- 'ga4' holds the cached Analytics numbers; 'ga4_ai' the AI's written insights on them (made on request, kept 24 hours).
alter table public.google_cache drop constraint if exists google_cache_source_check;
alter table public.google_cache add constraint google_cache_source_check check (source in ('gsc', 'ga4', 'ga4_ai', 'ads'));
