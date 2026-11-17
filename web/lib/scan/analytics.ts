import { authUsers } from "./admin";
import { overallScore } from "./score";
import { live, rest } from "./store";
import type { Plan } from "./store-ext";
import type { ScanResult } from "./types";

/* Admin analytics: product usage over a time window, computed from the tables the app already writes, with the
   rows behind every number so nobody has to open the database. Server only; the route checks adminFromRequest
   first. Row fetches are capped, which is plenty at early traffic; move these to SQL views with counts once a
   window holds tens of thousands of scans. */

export type UserRow = { email: string; created: string | null; verified: boolean; lastSignIn: string | null; plan: string; type: string; sites: number; scans: number; inPeriod: boolean };
export type ScanLogRow = { id: string; at: string; host: string; email: string | null; status: string; score: number | null; error: string | null };
export type LeadRow = { at: string; name: string; email: string; host: string; hasAccount: boolean };
export type StuckRow = { email: string; created: string | null };
export type FeatureRow = { what: string; who: string; site: string; at: string | null };

export type Analytics = {
  /** 0 means all time. */
  days: number;
  since: string | null;
  usersAvailable: boolean; // false when the auth admin API cannot be reached
  totals: { users: number; verified: number; paid: number; sites: number; scheduled: number; aiTracked: number; uptime: number };
  window: { scans: number; done: number; failed: number; anonymous: number; hosts: number; leads: number; signups: number; active: number; sitesSaved: number; shares: number; comparisons: number; aiRuns: number };
  rows: { users: UserRow[]; scans: ScanLogRow[]; leads: LeadRow[]; stuck: StuckRow[]; features: FeatureRow[] };
  /** How many scans the scan log holds at most; the count above is the true number. */
  scanLogCap: number;
};

const CAP = 20_000;
const LOG = 1_000;

export async function adminAnalytics(days: number): Promise<Analytics> {
  const since = days ? new Date(Date.now() - days * 86_400_000) : new Date(0);
  if (days) since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const s = encodeURIComponent(sinceIso);
  const inWin = (iso?: string | null) => !!iso && iso >= sinceIso;

  const empty: Analytics = {
    days,
    since: days ? sinceIso : null,
    usersAvailable: false,
    totals: { users: 0, verified: 0, paid: 0, sites: 0, scheduled: 0, aiTracked: 0, uptime: 0 },
    window: { scans: 0, done: 0, failed: 0, anonymous: 0, hosts: 0, leads: 0, signups: 0, active: 0, sitesSaved: 0, shares: 0, comparisons: 0, aiRuns: 0 },
    rows: { users: [], scans: [], leads: [], stuck: [], features: [] },
    scanLogCap: LOG,
  };
  if (!live()) return empty;

  // Optional tables (added by later migrations) fall back to empty rather than failing the page.
  const opt = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  type SiteRow = { id: string; user_id: string; host: string; created_at: string; cadence: string; ai_track?: boolean; uptime: boolean };
  type ProfileRow = { user_id: string; plan: Plan; account_type?: string | null };
  const [users, scans, log, leads, profiles, sites, shares, comparisons, aiRuns, links] = await Promise.all([
    authUsers(),
    rest<{ id: string; created_at: string; status: string; user_id: string | null; host: string }[]>(`scans?created_at=gte.${s}&select=id,created_at,status,user_id,host&order=created_at.desc&limit=${CAP}`),
    rest<{ id: string; error: string | null; modules: ScanResult["modules"] | null }[]>(`scans?created_at=gte.${s}&select=id,error,modules:result->modules&order=created_at.desc&limit=${LOG}`),
    opt(rest<{ created_at: string; scan_id: string; name: string; email: string; host: string }[]>(`leads?created_at=gte.${s}&select=created_at,scan_id,name,email,host&order=created_at.desc&limit=${CAP}`)),
    opt(rest<ProfileRow[]>(`profiles?select=user_id,plan,account_type&limit=${CAP}`).catch(() => rest<ProfileRow[]>(`profiles?select=user_id,plan&limit=${CAP}`))),
    rest<SiteRow[]>(`sites?select=*&limit=${CAP}`),
    opt(rest<{ created_at: string; user_id: string; scan_id: string }[]>(`shared_reports?created_at=gte.${s}&select=created_at,user_id,scan_id&order=created_at.desc&limit=${CAP}`)),
    opt(rest<{ created_at: string; user_id: string; scan_id: string }[]>(`comparisons?created_at=gte.${s}&select=created_at,user_id,scan_id&order=created_at.desc&limit=${CAP}`)),
    opt(rest<{ at: string }[]>(`ai_runs?at=gte.${s}&select=at&limit=${CAP}`)),
    opt(rest<{ site_id: string; user_id: string; gsc_property?: string | null; ga4_property?: string | null; ads_customer?: string | null; updated_at: string }[]>(`google_links?select=*&limit=${CAP}`)),
  ]);

  const emailOf = new Map((users ?? []).filter((u) => u.email).map((u) => [u.id, u.email!]));
  const who = (id: string | null | undefined) => (id ? (emailOf.get(id) ?? id.slice(0, 8)) : "–");
  const profileOf = new Map(profiles.map((p) => [p.user_id, p]));
  const siteOf = new Map(sites.map((x) => [x.id, x]));
  const scanHost = new Map(scans.map((r) => [r.id, r.host]));
  const leadOf = new Map(leads.map((l) => [l.scan_id, l.email]));
  const accounts = new Set((users ?? []).map((u) => u.email?.toLowerCase()).filter(Boolean));

  const count = (rows: { user_id: string | null }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.user_id) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };
  const scansBy = count(scans);
  const sitesBy = count(sites);
  const signups = (users ?? []).filter((u) => inWin(u.created_at));
  const logOf = new Map(log.map((r) => [r.id, r]));

  const features: FeatureRow[] = [
    ...shares.map((r) => ({ what: "Shared a report", who: who(r.user_id), site: scanHost.get(r.scan_id) ?? "–", at: r.created_at })),
    ...comparisons.map((r) => ({ what: "Compared competitors", who: who(r.user_id), site: scanHost.get(r.scan_id) ?? "–", at: r.created_at })),
    ...links.flatMap((l) => {
      const site = siteOf.get(l.site_id)?.host ?? "–";
      const row = (what: string) => ({ what, who: who(l.user_id), site, at: l.updated_at });
      return [...(l.gsc_property ? [row("Connected Search Console")] : []), ...(l.ga4_property ? [row("Connected Google Analytics")] : []), ...(l.ads_customer ? [row("Connected Google Ads")] : [])];
    }),
    ...sites.filter((x) => x.cadence !== "none").map((x) => ({ what: `Scheduled rescans (${x.cadence})`, who: who(x.user_id), site: x.host, at: null })),
    ...sites.filter((x) => x.ai_track).map((x) => ({ what: "AI tracking on", who: who(x.user_id), site: x.host, at: null })),
    ...sites.filter((x) => x.uptime).map((x) => ({ what: "Uptime monitoring on", who: who(x.user_id), site: x.host, at: null })),
  ];

  return {
    ...empty,
    usersAvailable: !!users,
    totals: {
      users: users?.length ?? 0,
      verified: (users ?? []).filter((u) => u.email_confirmed_at).length,
      paid: profiles.filter((p) => p.plan !== "free").length,
      sites: sites.length,
      scheduled: sites.filter((x) => x.cadence !== "none").length,
      aiTracked: sites.filter((x) => x.ai_track).length,
      uptime: sites.filter((x) => x.uptime).length,
    },
    window: {
      scans: scans.length,
      done: scans.filter((r) => r.status === "done").length,
      failed: scans.filter((r) => r.status === "failed").length,
      anonymous: scans.filter((r) => !r.user_id).length,
      hosts: new Set(scans.map((r) => r.host)).size,
      leads: leads.length,
      signups: signups.length,
      active: (users ?? []).filter((u) => inWin(u.last_sign_in_at)).length,
      sitesSaved: sites.filter((x) => inWin(x.created_at)).length,
      shares: shares.length,
      comparisons: comparisons.length,
      aiRuns: aiRuns.length,
    },
    rows: {
      users: (users ?? [])
        .map((u) => {
          const p = profileOf.get(u.id);
          return { email: u.email ?? u.id.slice(0, 8), created: u.created_at ?? null, verified: !!u.email_confirmed_at, lastSignIn: u.last_sign_in_at ?? null, plan: p?.plan ?? "free", type: p?.account_type || "not asked", sites: sitesBy.get(u.id) ?? 0, scans: scansBy.get(u.id) ?? 0, inPeriod: inWin(u.created_at) };
        })
        .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "")),
      scans: scans.slice(0, LOG).map((r) => {
        const extra = logOf.get(r.id);
        const m = extra?.modules;
        return { id: r.id, at: r.created_at, host: r.host, email: (r.user_id && emailOf.get(r.user_id)) || leadOf.get(r.id) || null, status: r.status, score: r.status === "done" && Array.isArray(m) && m.length ? overallScore(m) : null, error: extra?.error ?? null };
      }),
      leads: leads.map((l) => ({ at: l.created_at, name: l.name, email: l.email, host: l.host, hasAccount: accounts.has(l.email.toLowerCase()) })),
      stuck: (users ?? []).filter((u) => !u.email_confirmed_at).map((u) => ({ email: u.email ?? u.id.slice(0, 8), created: u.created_at ?? null })).sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "")),
      features,
    },
  };
}
