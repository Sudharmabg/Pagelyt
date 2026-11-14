/* Homepage copy shared by the client sections (home-convert.tsx) and the server page (FAQ schema). Plain data. */
import { TOOL_LIST } from "./tools/catalog";

/** Tools anyone with a free account can run (a few spend paid rendering time). */
export const FREE_TOOLS = TOOL_LIST.filter((t) => !t.paid);

/** Words the hero headline cycles through. The full list is also in the H1 as text for search engines. */
export const ROTATOR = ["SEO", "Page Speed", "AI Search", "Security", "Accessibility"];

/** Product facts only: no usage counts. */
export const STATS: { n: number; prefix?: string; suffix?: string; label: string }[] = [
  { n: 8, label: "areas checked in every scan" },
  { n: FREE_TOOLS.length, label: "free SEO and AI tools" },
  { n: 1, suffix: " URL", label: "is all the setup you need" },
  { n: 0, prefix: "₹", label: "to start your first audit" },
];

export const PROCESS = [
  { h: "Paste your URL", p: "No install, no code, no access to your hosting. Pagelyt reads your public pages." },
  { h: "Get one clear score", p: "Eight areas, from speed and SEO to AI search and security, roll up into a single score." },
  { h: "Fix what matters first", p: "Every issue comes with evidence and a plain-English fix, ranked by impact." },
];

export type Mark = "yes" | "part" | "no";
export const COMPARE_COLS = ["Pagelyt", "Typical SEO tools", "Manual agency audit"];
export const COMPARE: { row: string; cells: [Mark, string][] }[] = [
  { row: "Cost to start", cells: [["yes", "Free"], ["part", "Monthly subscription"], ["no", "One-off fee per audit"]] },
  { row: "Time to first report", cells: [["yes", "Minutes"], ["part", "Minutes, after setup"], ["no", "Days to weeks"]] },
  { row: "AI search (GEO) readiness", cells: [["yes", "Included"], ["part", "Rarely"], ["part", "Depends on the agency"]] },
  { row: "Speed, SEO, security and accessibility in one place", cells: [["yes", "One scan"], ["no", "Separate tools"], ["part", "Sometimes"]] },
  { row: "Search Console, Analytics and Ads data on every fix", cells: [["yes", "Professional & Business"], ["part", "Separate dashboards"], ["part", "Manual exports"]] },
  { row: "Fixes in plain English, ranked by impact", cells: [["yes", "Yes"], ["no", "Raw data to interpret"], ["yes", "Yes"]] },
  { row: "Ongoing monitoring", cells: [["yes", "On paid plans"], ["yes", "Yes"], ["no", "One-off"]] },
];

/* Example outcomes for "What a clear report changes": typical problems Pagelyt finds and the kind of change fixing
   them makes. Illustrative cases, not customer results: no names or quotes. Never mark these up as Review
   schema or present them as testimonials. */
export type Story = { who: string; metric: string; before: number; after: number; found: string[]; time: string };
export const STORIES: Story[] = [
  {
    who: "Dental clinic",
    metric: "Mobile speed score",
    before: 41,
    after: 78,
    found: ["A 2.4 MB hero image", "3 scripts blocking the page"],
    time: "One afternoon",
  },
  {
    who: "Online store",
    metric: "SEO score",
    before: 58,
    after: 86,
    found: ["14 pages missing meta descriptions", "Broken links in the footer"],
    time: "Two days",
  },
  {
    who: "Accounting firm",
    metric: "AI search readiness",
    before: 34,
    after: 72,
    found: ["AI crawlers blocked in robots.txt", "No structured data on service pages"],
    time: "One hour",
  },
];
