export type Severity = "high" | "medium" | "low";

export type Finding = {
  id: string;
  module: ModuleKey;
  severity: Severity;
  title: string;
  why: string;
  fix: string;
  evidence?: string;
  /** Every affected page, for findings that list pages (the evidence above keeps only the first few). Reports saved
      before this existed don't have it. `cols` names the columns after "Page"; each row's `cells` match them. */
  pages?: PageTable;
};

export type PageTable = { cols: string[]; rows: { url: string; cells: string[] }[] };

/** The evidence written out in full: every page when the finding has its table (for copying and CSV export). */
export function evidenceText(f: Finding): string {
  if (!f.pages?.rows.length) return f.evidence ?? "";
  return f.pages.rows.map((r) => [r.url, ...r.cells].filter(Boolean).join(" — ")).join("\n");
}

export type ModuleKey = "health" | "performance" | "seo" | "geo" | "security" | "accessibility" | "domain" | "privacy";

export const MODULE_NAMES: Record<ModuleKey, string> = {
  health: "Website health",
  performance: "Performance",
  seo: "SEO",
  geo: "GEO readiness",
  security: "Security",
  accessibility: "Accessibility",
  domain: "Domain & email",
  privacy: "Privacy & compliance",
};

export type ScanResult = {
  url: string;
  host: string;
  scannedAt: string;
  overall: number;
  modules: { key: ModuleKey; name: string; score: number }[];
  findings: Finding[];
  /** Optional: older stored reports do not have these. */
  tech?: TechItem[];
  vitals?: Vitals | null;
  domain?: DomainInfo | null;
  links?: { checked: number; broken: number } | null;
  crawl?: CrawlSummary | null;
  images?: ImageAudit | null;
  /** Homepage fingerprint, and how it differs from the previous scan of the same site. */
  snapshot?: Snapshot | null;
  change?: ChangeInfo | null;
};

/** `sig`: 16 × 32 brightness grid of the rendered page; `text`: MinHash of the visible text. */
export type Snapshot = { title: string; sig: number[] | null; text: number[]; shot: boolean };
/** Percentages, 0–100; null when either side could not be measured. */
export type ChangeInfo = { prevId: string; prevAt: string; visual: number | null; text: number | null; title: { from: string; to: string } | null };

/** `probed`: what the server actually delivered for a sample of the page's images. */
/** `count`: distinct images found across the homepage and crawled pages (`pages` of them). `probed`: the ones
    whose format and size were checked; `page` is the address of a page that shows it (missing in older reports). */
export type ImageAudit = { count: number; pages?: number; probed: { url: string; type: string; bytes: number | null; page?: string }[] };
/** From Lighthouse (mobile run), bytes. */
export type PageWeight = { total: number | null; images: number | null; imageSavings: number | null; requests: number | null };

export type CrawlPage = {
  url: string; status: number; title: string; description: string; h1: number; canonical: boolean; noindex: boolean; words: number;
  /** Optional (newer scans): canonical target, hreflang alternates, structured-data problems. */
  canonicalUrl?: string; alts?: { lang: string; href: string }[]; ld?: string[];
};
/** Why the crawl stopped where it did (newer scans only).
    `found`: distinct pages known before crawling (sitemap + homepage links, homepage excluded); `homeLinks`: internal
    links on the homepage; `linked`: pages the crawled pages link to that were never visited (capped near 600); `missed`: queued pages
    that didn't answer in time; `sitemap`: what /sitemap.xml held; `limit`: the page cap per scan. */
export type CrawlStop = { found: number; homeLinks: number; linked: number; missed: number; sitemap: "none" | "index" | "list"; limit: number };
export type CrawlSummary = { pages: number; sitemapUrls: number; broken: number; list: CrawlPage[]; stop?: CrawlStop };

export type TechItem = { name: string; category: string };

export type VitalsRun = {
  score: number | null;
  fcp: number | null; // ms
  lcp: number | null; // ms
  cls: number | null;
  tbt: number | null; // ms
  speedIndex: number | null; // ms
};

/** Lab data (Lighthouse, simulated) and field data (real Chrome users, when Google has enough). */
export type Vitals = {
  mobile: VitalsRun | null;
  desktop: VitalsRun | null;
  field: { lcp: number | null; inp: number | null; cls: number | null } | null;
  /** Optional: older stored reports do not have it. */
  weight?: PageWeight | null;
  /** Lighthouse accessibility score (rendered page, mobile), 0–100. */
  a11y?: number | null;
};

export type DomainInfo = {
  mx: string[];
  ns: string[];
  spf: string | null;
  dmarc: string | null;
  expires: string | null; // ISO date
  /** Optional: older stored reports do not have these. null = could not tell. */
  dnssec?: boolean | null;
  caa?: string[];
  dkim?: string[]; // selectors that answered
};
