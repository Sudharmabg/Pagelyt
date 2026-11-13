-- Google Ads for the Google integrations. Run once in the Supabase SQL editor, after 0011, before deploying the code
-- that goes with it.

-- The Google Ads account linked to each saved site: its customer id (digits only), the manager account it is read
-- through (agencies; null when the account is read directly) and its name.
alter table public.google_links add column if not exists ads_customer text;
alter table public.google_links add column if not exists ads_login text;
alter table public.google_links add column if not exists ads_name text;

-- 'ads' holds the cached Google Ads numbers; 'ads_ai' the AI's written insights on them (made on request, kept 24 hours).
alter table public.google_cache drop constraint if exists google_cache_source_check;
alter table public.google_cache add constraint google_cache_source_check check (source in ('gsc', 'ga4', 'ga4_ai', 'ads', 'ads_ai'));
