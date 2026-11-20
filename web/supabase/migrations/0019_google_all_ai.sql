-- Google data: the combined AI insights (Search Console, Analytics and Google Ads read together) are cached as
-- 'all_ai', next to the per-product 'gsc_ai', 'ga4_ai' and 'ads_ai'. Run once in the Supabase SQL editor, after 0018,
-- before deploying the code that goes with it.
alter table public.google_cache drop constraint if exists google_cache_source_check;
alter table public.google_cache add constraint google_cache_source_check check (source in (
  'gsc', 'gsc_7', 'gsc_90', 'gsc_ai',
  'ga4', 'ga4_7', 'ga4_90', 'ga4_ai',
  'ads', 'ads_7', 'ads_90', 'ads_ai',
  'all_ai'
));
