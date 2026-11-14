import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanGscInsights, gscPrompt } from "./gsc-ai";
import type { GscData } from "./gsc-insights";
import type { ScanResult } from "../scan/types";

const d: GscData = {
  property: "sc-domain:example.com",
  range: { start: "2026-10-01", end: "2026-10-28" },
  prevRange: { start: "2026-09-03", end: "2026-09-30" },
  totals: { clicks: 120, impressions: 4000, ctr: 0.03, position: 9.2, prevClicks: 200, prevImpressions: 4100 },
  daily: [],
  pages: [{ url: "https://example.com/pricing", clicks: 40, impressions: 900, ctr: 0.044, position: 6.1, prevClicks: 80, prevImpressions: 950 }],
  queries: [],
  inspections: [],
  devices: [{ key: "MOBILE", clicks: 80, impressions: 3000 }],
};
const res = {
  host: "example.com",
  url: "https://example.com/",
  scannedAt: "2026-11-12T00:00:00Z",
  overall: 70,
  modules: [],
  findings: [{ id: "slow-lcp", module: "performance", severity: "high", title: "Slow LCP", why: "", fix: "Make it faster", pages: { cols: [], rows: [{ url: "https://example.com/pricing", cells: [] }] } }],
} as unknown as ScanResult;

test("prompt carries the pages table, devices and issue ids", () => {
  const p = gscPrompt(d, res);
  assert.match(p, /\/pricing \| clicks 40 \(before 80\)/);
  assert.match(p, /mobile 80 clicks/);
});

test("keeps only real paths and issue ids", () => {
  const out = cleanGscInsights({ insights: [{ title: "T", detail: "D", action: "A", priority: "high", pages: ["/pricing", "/made-up"], findings: ["slow-lcp", "nope"] }, { title: "", detail: "x" }] }, d, res);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].pages, ["/pricing"]);
  assert.deepEqual(out[0].findings, ["slow-lcp"]);
});
