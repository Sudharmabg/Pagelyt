-- Score-drop alerts and faster history lookups. Run after 0002_whitelabel_ai.sql.

alter table public.sites
  add column if not exists alerts boolean not null default true;   -- email when a scheduled rescan finds a drop or a new high issue

create index if not exists scans_site_created on public.scans (site_id, created_at desc) where status = 'done';
