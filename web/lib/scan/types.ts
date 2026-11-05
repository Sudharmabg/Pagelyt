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

export type ModuleKey = "health" | "performance" | "seo" | "geo" | "security" | "accessibility";

export const MODULE_NAMES: Record<ModuleKey, string> = {
  health: "Website health",
  performance: "Performance",
  seo: "SEO",
  geo: "GEO readiness",
  security: "Security",
  accessibility: "Accessibility",
};

export type ScanResult = {
  url: string;
  host: string;
  scannedAt: string;
  overall: number;
  modules: { key: ModuleKey; name: string; score: number }[];
  findings: Finding[];
};
