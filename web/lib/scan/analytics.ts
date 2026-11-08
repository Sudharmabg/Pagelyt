import { authUsers } from "./admin";
import { live, rest } from "./store";
import type { Plan } from "./store-ext";

/* Admin analytics: product usage over a time window, computed from the tables the app already writes.
   Server only; the route checks adminFromRequest first. Row fetches are capped, which is plenty at early
   traffic; move these to SQL views with counts once a window holds tens of thousands of scans. */

export type Analytics = {
  days: number;
  usersAvailable: boolean; // false when the auth admin API cannot be reached (local mock)
  totals: { users: number; verified: number; paid: number; sites: number; scheduled: number; aiTracked: number; uptime: number };
  window: { scans: number; done: number; failed: number; anonymous: number; hosts: number; leads: number; signups: number; active: number; sitesSaved: number; shares: number; comparisons: number; aiRuns: number };
  daily: { day: string; scans: number; signups: number; leads: number }[];
  funnel: { label: string; n: number }[];
  plans: { label: string; n: number }[];
  accountTypes: { label: string; n: number }[];
  topHosts: { label: string; n: number }[];
};

const CAP = 20_000;
const dayOf = (iso: string) => iso.slice(0, 10);

export async function adminAnalytics(days: number): Promise<Analytics> {
  const since = new Date(Date.now() - days * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const s = encodeURIComponent(sinceIso);
  const inWin = (iso?: string | null) => !!iso && iso >= sinceIso;

  const daily = Array.from({ length: days + 1 }, (_, i) => ({ day: dayOf(new Date(since.getTime() + i * 86_400_000).toISOString()), scans: 0, signups: 0, leads: 0 }));
  const empty: Analytics = {
    days,
    usersAvailable: false,
    totals: { users: 0, verified: 0, paid: 0, sites: 0, scheduled: 0, aiTracked: 0, uptime: 0 },
    window: { scans: 0, done: 0, failed: 0, anonymous: 0, hosts: 0, leads: 0, signups: 0, active: 0, sitesSaved: 0, shares: 0, comparisons: 0, aiRuns: 0 },
    daily,
    funnel: [],
    plans: [],
    accountTypes: [],
    topHosts: [],
  };
  if (!live()) return empty;

  // Optional tables (added by later migrations) fall back to empty rather than failing the page.
  const opt = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const [users, scans, leads, profiles, sites, shares, comparisons, aiRuns] = await Promise.all([
    authUsers(),
    rest<{ created_at: string; status: string; user_id: string | null; host: string }[]>(`scans?created_at=gte.${s}&select=created_at,status,user_id,host&limit=${CAP}`),
    opt(rest<{ created_at: string }[]>(`leads?created_at=gte.${s}&select=created_at&limit=${CAP}`)),
    opt(rest<{ plan: Plan; account_type?: string | null }[]>(`profiles?select=plan,account_type&limit=${CAP}`).catch(() => rest<{ plan: Plan }[]>(`profiles?select=plan&limit=${CAP}`))),
    rest<{ created_at: string; cadence: string; ai_track?: boolean; uptime: boolean }[]>(`sites?select=*&limit=${CAP}`),
    opt(rest<{ created_at: string }[]>(`shared_reports?created_at=gte.${s}&select=created_at&limit=${CAP}`)),
    opt(rest<{ created_at: string }[]>(`comparisons?created_at=gte.${s}&select=created_at&limit=${CAP}`)),
    opt(rest<{ at: string }[]>(`ai_runs?at=gte.${s}&select=at&limit=${CAP}`)),
  ]);

  const byDay = new Map(daily.map((d) => [d.day, d]));
  for (const r of scans) { const d = byDay.get(dayOf(r.created_at)); if (d) d.scans++; }
  for (const r of leads) { const d = byDay.get(dayOf(r.created_at)); if (d) d.leads++; }
  const signups = (users ?? []).filter((u) => inWin(u.created_at));
  for (const u of signups) { const d = byDay.get(dayOf(u.created_at!)); if (d) d.signups++; }

  const hostCount = new Map<string, number>();
  for (const r of scans) hostCount.set(r.host, (hostCount.get(r.host) ?? 0) + 1);
  const count = <T,>(rows: T[], key: (r: T) => string, order: string[]) => {
    const m = new Map(order.map((k) => [k, 0]));
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m].map(([label, n]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), n }));
  };
  const sitesSaved = sites.filter((x) => inWin(x.created_at)).length;
  const verifiedSignups = signups.filter((u) => u.email_confirmed_at).length;

  return {
    days,
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
      hosts: hostCount.size,
      leads: leads.length,
      signups: signups.length,
      active: (users ?? []).filter((u) => inWin(u.last_sign_in_at)).length,
      sitesSaved,
      shares: shares.length,
      comparisons: comparisons.length,
      aiRuns: aiRuns.length,
    },
    daily,
    funnel: [
      { label: "Scans run", n: scans.length },
      { label: "Left contact details", n: leads.length },
      ...(users ? [{ label: "Signed up", n: signups.length }, { label: "Verified email", n: verifiedSignups }] : []),
      { label: "Saved a site", n: sitesSaved },
    ],
    plans: count(profiles, (p) => p.plan, ["free", "essential", "professional", "business"]),
    accountTypes: count(profiles, (p) => (p as { account_type?: string | null }).account_type || "not asked", ["agency", "owner", "not asked"]),
    topHosts: [...hostCount].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, n]) => ({ label, n })),
  };
}
