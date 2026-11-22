import { Accessibility, Activity, Bot, ChartLine, CodeXml, Cookie, Gauge, Lightbulb, ListChecks, MailCheck, Plug, Search, ShieldCheck, Swords, type LucideIcon } from "lucide-react";

/** Icon and colour pair for each feature (features-data slugs), shared by the Features menu and the phone menu. */
export const FEATURE_ICON: Record<string, { icon: LucideIcon; c1: string; c2: string }> = {
  "website-health": { icon: Activity, c1: "#14a58e", c2: "#5ee0c4" },
  performance: { icon: Gauge, c1: "#f08c1a", c2: "#ffc46b" },
  seo: { icon: Search, c1: "#3b82f6", c2: "#8cc1ff" },
  geo: { icon: Bot, c1: "#7c5cf0", c2: "#c3b1ff" },
  security: { icon: ShieldCheck, c1: "#22a35a", c2: "#7ee0a3" },
  accessibility: { icon: Accessibility, c1: "#0e8fd6", c2: "#7cc9f5" },
  "wcag-checklist": { icon: ListChecks, c1: "#4b44c9", c2: "#8f88ff" },
  "domain-email": { icon: MailCheck, c1: "#d9622b", c2: "#ffad85" },
  privacy: { icon: Cookie, c1: "#b0861a", c2: "#f1cf6e" },
  "code-security": { icon: CodeXml, c1: "#3f3cbb", c2: "#5fb4f0" },
  "competitor-intelligence": { icon: Swords, c1: "#e0457b", c2: "#ff9cbf" },
  "ai-recommendations": { icon: Lightbulb, c1: "#9b5cf0", c2: "#d1b3ff" },
  "monitoring-reports": { icon: ChartLine, c1: "#06a5c4", c2: "#7fe3f5" },
  "google-integrations": { icon: Plug, c1: "#e8a400", c2: "#ffd766" },
};

/** Features marked "New" in the menus. */
export const NEW_FEATURES = new Set(["wcag-checklist", "code-security"]);
