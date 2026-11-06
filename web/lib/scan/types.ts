export type Severity = "high" | "medium" | "low";

export type Finding = {
  id: string;
  module: ModuleKey;
  severity: Severity;
  title: string;
  why: string;
  fix: string;
  evidence?: string;
};

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
};

export type CrawlPage = { url: string; status: number; title: string; description: string; h1: number; canonical: boolean; noindex: boolean; words: number };
export type CrawlSummary = { pages: number; sitemapUrls: number; broken: number; list: CrawlPage[] };

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
};

export type DomainInfo = {
  mx: string[];
  ns: string[];
  spf: string | null;
  dmarc: string | null;
  expires: string | null; // ISO date
};
