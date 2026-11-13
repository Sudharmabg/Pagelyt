import assert from "node:assert/strict";
import { test } from "node:test";
import { analysePrompt, cleanInsights } from "./ga4-ai.ts";
import type { Ga4Data } from "./ga4-insights.ts";
import type { ScanResult } from "../scan/types.ts";

const T = { sessions: 100, engaged: 60, users: 80, newUsers: 40, views: 200, avgDuration: 90, keyEvents: 2 };
const d: Ga4Data = {
  property: "properties/1",
  name: null,
  range: { start: "2026-10-16", end: "2026-11-12" },
  prevRange: { start: "2026-09-18", end: "2026-10-15" },
  totals: T,
  prev: T,
  daily: [],
  pages: [{ path: "/", sessions: 80, engaged: 50, views: 150, prevSessions: 70, prevEngaged: 40 }, { path: "/pricing/", sessions: 20, engaged: 10, views: 50, prevSessions: 60, prevEngaged: 30 }],
  channels: [],
  pageChannels: [],
};
const res = {
  host: "example.com",
  url: "https://example.com/",
  scannedAt: "2026-11-12T00:00:00Z",
  overall: 70,
  modules: [],
  findings: [{ id: "slow-lcp", module: "performance", severity: "high", title: "Slow", why: "", fix: "Make it faster", pages: { cols: [], rows: [{ url: "https://example.com/pricing", cells: [] }] } }],
} as unknown as ScanResult;

test("the prompt carries the pages table with the issues on each page", () => {
  const p = analysePrompt(d, res);
  assert.match(p, /\/pricing \| visits 20 \(before 60\) \| engaged 50% \| views 50 \| issues slow-lcp/);
  assert.match(p, /\[slow-lcp\]/);
});

test("cleanInsights keeps only real pages and issue ids, and clips the rest", () => {
  const out = cleanInsights(
    {
      insights: [
        { title: "Pricing fell", detail: "From 60 to 20.", action: "Fix it.", priority: "high", pages: ["/pricing", "/made-up"], findings: ["slow-lcp", "nope"] },
        { title: "", detail: "no title", action: "", priority: "high", pages: [], findings: [] },
        { title: "Odd priority", detail: "x", action: "y", priority: "urgent", pages: "/", findings: null },
      ],
    },
    d,
    res
  );
  assert.deepEqual(out, [
    { title: "Pricing fell", detail: "From 60 to 20.", action: "Fix it.", priority: "high", pages: ["/pricing"], findings: ["slow-lcp"] },
    { title: "Odd priority", detail: "x", action: "y", priority: "medium", pages: [], findings: [] },
  ]);
  assert.deepEqual(cleanInsights("nonsense", d, res), []);
});
