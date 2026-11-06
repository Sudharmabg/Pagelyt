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
