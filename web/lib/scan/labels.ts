/* Client-safe: the stages of a scan, used by the progress screen and the server alike. */
export const STAGE_LABELS = [
  "Reading your page, robots.txt and sitemap",
  "Checking domain, email records and exposed files",
  "Testing links",
  "Crawling your pages (1 of 2)",
  "Crawling your pages (2 of 2)",
  "Measuring speed",
  "Building your report",
] as const;
export const TOTAL_STAGES = STAGE_LABELS.length;

/* After how many finished stages each area's score is final (no later stage adds findings to it). Stage 1 (page)
   settles privacy; 2 (domain, exposed files) domain and security; 5 (second crawl batch) health, SEO and GEO;
   6 (speed and Lighthouse) performance and accessibility. Keep in step with advanceScan in ./index.ts. */
export const AREA_DONE_AT = { privacy: 1, domain: 2, security: 2, health: 5, seo: 5, geo: 5, performance: 6, accessibility: 6 } as const;
