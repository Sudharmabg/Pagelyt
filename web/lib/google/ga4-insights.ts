/* Google Analytics (GA4) data as Pagelyt caches it, and the pure calculations on top of it: visitors and engagement
   per finding, pages that lost visitors (and through which channel), the 28-day report and the AI's insights.
   Client-safe (no secrets, no fetch), so the dashboard, the print page and the assistant use the same numbers. */

import type { Finding } from "../scan/types";
import { change, SITEWIDE } from "./gsc-insights";

export type Ga4Totals = { sessions: number; engaged: number; users: number; newUsers: number; views: number; avgDuration: number; keyEvents: number };
export type Ga4Page = { path: string; sessions: number; engaged: number; views: number; prevSessions: number; prevEngaged: number };
export type Ga4Channel = { channel: string; sessions: number; engaged: number; prevSessions: number };
export type Ga4PageChannel = { path: string; channel: string; sessions: number; prevSessions: number };
/** Sessions for one device category or country (GA4's own names, e.g. "mobile", "India"). */
export type Ga4Split = { key: string; sessions: number; engaged: number };
export type Ga4Data = {
  property: string;
  /** Length of the window in days (7, 28 or 90). Older caches have none: 28. */
  days?: number;
  devices?: Ga4Split[];
  countries?: Ga4Split[];
  name: string | null;
  range: { start: string; end: string };
  prevRange: { start: string; end: string };
  totals: Ga4Totals;
  prev: Ga4Totals;
  daily: { date: string; sessions: number; users: number }[];
  pages: Ga4Page[];
  channels: Ga4Channel[];
  pageChannels: Ga4PageChannel[];
};

/** One written insight from the AI analysis. `findings` are finding ids from the report it was given. */
export type Ga4Insight = { title: string; detail: string; action: string; priority: "high" | "medium" | "low"; pages: string[]; findings: string[] };
export type Ga4Ai = { insights: Ga4Insight[]; basedOn: string; model: string };

export const rate = (engaged: number, sessions: number) => (sessions ? engaged / sessions : 0);

/** A URL or GA4 page path as a comparable path: no scheme or host, no trailing slash, no query or fragment. */
export function gaPath(u: string): string {
  let p = u;
  try {
    if (/^https?:\/\//i.test(u)) p = new URL(u).pathname;
  } catch {
    /* keep as given */
  }
  p = p.split(/[?#]/)[0] || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  return p.length > 1 ? p.replace(/\/+$/, "") || "/" : "/";
}

export function ga4Index(d: Ga4Data): Map<string, Ga4Page> {
  const m = new Map<string, Ga4Page>();
  for (const p of d.pages) {
    const k = gaPath(p.path);
    const had = m.get(k);
    if (had) m.set(k, { ...had, sessions: had.sessions + p.sessions, engaged: had.engaged + p.engaged, views: had.views + p.views, prevSessions: had.prevSessions + p.prevSessions, prevEngaged: had.prevEngaged + p.prevEngaged });
    else m.set(k, { ...p, path: k });
  }
  return m;
}

export type Visits = { sessions: number; engaged: number; scope: "pages" | "homepage" | "site"; pages: number };

/** Visitors on the pages a finding affects over the last 28 days: its listed pages, otherwise the whole site for
    site-wide areas, otherwise the homepage. Same rule as Google clicks per finding. */
export function visitsFor(f: Finding, d: Ga4Data, idx = ga4Index(d)): Visits {
  if (f.pages?.rows.length) {
    let sessions = 0, engaged = 0, pages = 0;
    for (const k of new Set(f.pages.rows.map((r) => gaPath(r.url)))) {
      const p = idx.get(k);
      if (p) {
        sessions += p.sessions;
        engaged += p.engaged;
        pages++;
      }
    }
    return { sessions, engaged, scope: "pages", pages };
  }
  if (SITEWIDE.has(f.module)) return { sessions: d.totals.sessions, engaged: d.totals.engaged, scope: "site", pages: 0 };
  const h = idx.get("/");
  return { sessions: h?.sessions ?? 0, engaged: h?.engaged ?? 0, scope: "homepage", pages: h ? 1 : 0 };
}

export function visitsMap(findings: Finding[], d: Ga4Data, key: (f: Finding) => string): Map<string, Visits> {
  const idx = ga4Index(d);
  return new Map(findings.map((f) => [key(f), visitsFor(f, d, idx)]));
}

const SEV = { high: 3, medium: 2, low: 1 } as const;
/** Most visitors first, then the more important issue. */
export function byVisits(findings: Finding[], v: Map<string, Visits>, key: (f: Finding) => string): Finding[] {
  return [...findings].sort((a, b) => (v.get(key(b))?.sessions ?? 0) - (v.get(key(a))?.sessions ?? 0) || SEV[b.severity] - SEV[a.severity]);
}

export type Ga4Drop = Ga4Page & { lost: number; channel: string | null; channelLost: number };

/** Pages that lost at least 30% of their visits on the 28 days before (and had at least 20), with the channel that
    lost the most of them. */
export function ga4Drops(d: Ga4Data, max = 10): Ga4Drop[] {
  const byPage = new Map<string, Ga4PageChannel[]>();
  for (const r of d.pageChannels) {
    const k = gaPath(r.path);
    byPage.set(k, [...(byPage.get(k) ?? []), r]);
  }
  return [...ga4Index(d).values()]
    .filter((p) => p.prevSessions >= 20 && p.sessions < p.prevSessions * 0.7)
    .map((p) => {
      const lostBy = new Map<string, number>();
      for (const r of byPage.get(p.path) ?? []) lostBy.set(r.channel, (lostBy.get(r.channel) ?? 0) + r.prevSessions - r.sessions);
      const [channel, channelLost] = [...lostBy].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
      return { ...p, lost: p.prevSessions - p.sessions, channel: channelLost > 0 ? channel : null, channelLost: Math.max(0, channelLost) };
    })
    .sort((a, b) => b.lost - a.lost)
    .slice(0, max);
}

/** Findings that list this page path. */
export function findingsOnPath(path: string, findings: Finding[]): Finding[] {
  const k = gaPath(path);
  return findings.filter((f) => f.pages?.rows.some((r) => gaPath(r.url) === k));
}

/** Busy pages (50+ visits) where few visits are engaged: well under the site's own rate, or under 40%. */
export function lowEngagement(d: Ga4Data, max = 8): (Ga4Page & { rate: number })[] {
  const site = rate(d.totals.engaged, d.totals.sessions);
  return [...ga4Index(d).values()]
    .filter((p) => p.sessions >= 50)
    .map((p) => ({ ...p, rate: rate(p.engaged, p.sessions) }))
    .filter((p) => p.rate < Math.min(0.4, site - 0.15) || p.rate < site * 0.6)
    .sort((a, b) => b.sessions * (1 - b.rate) - a.sessions * (1 - a.rate))
    .slice(0, max);
}

export type ChannelRow = Ga4Channel & { share: number; change: number | null; rate: number };
export function channelRows(d: Ga4Data): ChannelRow[] {
  const total = d.totals.sessions || 1;
  return [...d.channels].sort((a, b) => b.sessions - a.sessions).map((c) => ({ ...c, share: c.sessions / total, change: change(c.sessions, c.prevSessions), rate: rate(c.engaged, c.sessions) }));
}

const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
const p0 = (n: number) => `${Math.round(n * 100)}%`;
const ch = (now: number, before: number) => {
  const c = change(now, before);
  return c == null ? "" : ` (${c > 0 ? "+" : ""}${c}% vs the 28 days before)`;
};

/** Analytics in a few lines, for the assistant's instructions and the AI analysis. */
export function ga4Brief(d: Ga4Data, findings: Finding[], key: (f: Finding) => string, ai?: Ga4Ai | null): string {
  const T = d.totals, P = d.prev;
  const out: string[] = [];
  out.push(`Google Analytics (${d.name ?? d.property}), ${d.range.start} to ${d.range.end}: ${n0(T.sessions)} visits${ch(T.sessions, P.sessions)}, ${n0(T.users)} visitors (${n0(T.newUsers)} new), ${n0(T.views)} page views, engagement rate ${p0(rate(T.engaged, T.sessions))} (was ${p0(rate(P.engaged, P.sessions))}), average visit ${Math.round(T.avgDuration)}s, ${n0(T.keyEvents)} key events${ch(T.keyEvents, P.keyEvents)}.`);
  const chs = channelRows(d).slice(0, 6);
  if (chs.length) out.push(`Channels: ${chs.map((c) => `${c.channel} ${n0(c.sessions)} visits${c.change == null ? "" : ` (${c.change > 0 ? "+" : ""}${c.change}%)`}, ${p0(c.rate)} engaged`).join("; ")}.`);
  const v = visitsMap(findings, d, key);
  const top = byVisits(findings, v, key).filter((f) => (v.get(key(f))?.sessions ?? 0) > 0 && v.get(key(f))!.scope !== "site").slice(0, 8);
  if (top.length) out.push(`Visits on the pages each open issue affects (28 days): ${top.map((f) => { const x = v.get(key(f))!; return `[${f.id}] ${n0(x.sessions)} visits, ${p0(rate(x.engaged, x.sessions))} engaged`; }).join("; ")}.`);
  const dr = ga4Drops(d, 5);
  if (dr.length) out.push(`Pages that lost visits: ${dr.map((p) => `${p.path} ${n0(p.prevSessions)}→${n0(p.sessions)}${p.channel ? ` (mostly ${p.channel})` : ""}${findingsOnPath(p.path, findings).length ? `, issues: ${findingsOnPath(p.path, findings).slice(0, 3).map((f) => f.id).join(", ")}` : ""}`).join("; ")}.`);
  const low = lowEngagement(d, 5);
  if (low.length) out.push(`Busy pages with low engagement: ${low.map((p) => `${p.path} ${n0(p.sessions)} visits, ${p0(p.rate)} engaged`).join("; ")}.`);
  if (ai?.insights.length) out.push(`AI insights already shown to the owner: ${ai.insights.map((i) => i.title).join("; ")}.`);
  return out.join("\n");
}
