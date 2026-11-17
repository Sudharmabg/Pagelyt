-- Weekly rescans for every saved site. Run once in the Supabase SQL editor, after 0001 to 0015.
-- New sites already start on weekly (lib/scan/store.ts saveSite). This switches the sites saved earlier with no
-- schedule ("Never") to weekly too. Their first rescan is spread over the next 7 days, so they don't all run at once.
update public.sites
   set cadence = 'weekly',
       next_run_at = now() + (random() * interval '7 days')
 where cadence = 'none';
