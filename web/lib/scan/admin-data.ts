import { authUsers } from "./admin";
import { overallScore } from "./score";
import { live, rest } from "./store";
import type { ModuleKey, ScanResult, Severity, Vitals } from "./types";

/* Admin panel lists: every scanned website, one website's scores, and the scans an admin made to share.
   Server only; callers check adminFromRequest first. Row fetches are capped, which is plenty at early traffic. */

const CAP = 20_000;
const SCORED = 600; // websites whose latest score is looked up (60 reports per request)
const enc = encodeURIComponent;

type Mods = ScanResult["modules"];
type Lite = { id: string; host: string; url: string; created_at: string; status: "running" | "done" | "failed"; error: string | null; user_id: string | null; invite?: boolean | null; opened_at?: string | null; claimed_at?: string | null };

const LITE = "id,host,url,created_at,status,error,user_id";
const INVITE = ",invite,opened_at,claimed_at";

/** Scan rows without their reports, newest first. Before migration 0014 the invite columns don't exist: read without them. */
async function lites(filter: string, limit: number): Promise<Lite[]> {
  const q = (cols: string) => rest<Lite[]>(`scans?${filter}select=${cols}&order=created_at.desc&limit=${limit}`);
  return q(LITE + INVITE).catch(() => q(LITE));
}

/** Area scores (and optionally speed numbers) for these reports. */
async function modulesFor(ids: string[], vitals = false): Promise<Map<string, { modules: Mods | null; vitals?: Vitals | null }>> {
  const out = new Map<string, { modules: Mods | null; vitals?: Vitals | null }>();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));
  const rows = await Promise.all(chunks.map((c) => rest<{ id: string; modules: Mods | null; vitals?: Vitals | null }[]>(`scans?id=in.(${c.map(enc).join(",")})&select=id,modules:result->modules${vitals ? ",vitals:result->vitals" : ""}`)));
  for (const r of rows.flat()) out.set(r.id, r);
  return out;
}

async function emailsById(): Promise<Map<string, string>> {
  return new Map(((await authUsers()) ?? []).filter((u) => u.email).map((u) => [u.id, u.email!]));
}

const scoreOf = (m: Mods | null | undefined) => (Array.isArray(m) && m.length ? overallScore(m) : null);

/* ---------- websites ---------- */

export type AdminWebsite = {
  host: string;
  /** Everyone attached to the website: the accounts that scanned or saved it, then emails left with a scan. */
  emails: string[];
  scans: number;
  failed: number;
  lastAt: string;
  lastStatus: Lite["status"];
  /** The newest finished report, if any. */
  reportId: string | null;
  score: number | null;
  saved: boolean;
  cadence: string | null;
  /** An admin's shared scan: waiting for someone to sign in, or already taken. */
  shared: "waiting" | "claimed" | null;
};

export async function adminWebsites(): Promise<AdminWebsite[]> {
  if (!live()) return [];
  const [scans, users, leads, sites] = await Promise.all([
    lites("", CAP),
    emailsById(),
    rest<{ scan_id: string; email: string }[]>(`leads?select=scan_id,email&order=created_at.desc&limit=${CAP}`).catch(() => []),
    rest<{ host: string; user_id: string; cadence: string }[]>(`sites?select=host,user_id,cadence&limit=${CAP}`).catch(() => []),
  ]);
  const leadOf = new Map(leads.map((l) => [l.scan_id, l.email]));
  const byHost = new Map<string, AdminWebsite & { set: Set<string> }>();
  for (const s of scans) {
    let w = byHost.get(s.host);
    if (!w) byHost.set(s.host, (w = { host: s.host, emails: [], set: new Set(), scans: 0, failed: 0, lastAt: s.created_at, lastStatus: s.status, reportId: null, score: null, saved: false, cadence: null, shared: null }));
    w.scans++;
    if (s.status === "failed") w.failed++;
    if (!w.reportId && s.status === "done") w.reportId = s.id;
    if (s.invite && !w.shared) w.shared = s.user_id ? "claimed" : "waiting";
    const email = (s.user_id && users.get(s.user_id)) || leadOf.get(s.id);
    if (email) w.set.add(email.toLowerCase());
  }
  for (const site of sites) {
    const w = byHost.get(site.host);
    if (!w) continue;
    w.saved = true;
    if (site.cadence !== "none") w.cadence = site.cadence;
    const email = users.get(site.user_id);
    if (email) w.set.add(email.toLowerCase());
  }
  const list = [...byHost.values()]; // already newest first: scans came newest first
  const mods = await modulesFor(list.slice(0, SCORED).map((w) => w.reportId).filter((x): x is string => !!x));
  return list.map(({ set, ...w }) => ({ ...w, emails: [...set], score: w.reportId ? scoreOf(mods.get(w.reportId)?.modules) : null }));
}

/* ---------- one website's scores ---------- */

export type AdminScanScore = {
  id: string;
  at: string;
  status: Lite["status"];
  error: string | null;
  email: string | null;
  /** An admin's shared scan nobody has signed in to yet. */
  waiting: boolean;
  score: number | null;
  areas: { key: ModuleKey; name: string; score: number }[];
};

export type AdminHostDetail = {
  host: string;
  scans: AdminScanScore[];
  /** The newest finished report: issue counts and speed numbers. */
  latest: { id: string; issues: Record<Severity, number>; speed: { mobile: number | null; desktop: number | null; lcp: number | null; cls: number | null; a11y: number | null } | null } | null;
};

export async function adminHostDetail(host: string): Promise<AdminHostDetail | null> {
  if (!live() || !host || host.length > 255) return null;
  const rows = await lites(`host=eq.${enc(host)}&`, 50);
  if (!rows.length) return null;
  const done = rows.filter((r) => r.status === "done");
  const [users, leads, mods, findings] = await Promise.all([
    emailsById(),
    rest<{ scan_id: string; email: string }[]>(`leads?host=eq.${enc(host)}&select=scan_id,email&limit=200`).catch(() => []),
    modulesFor(done.map((r) => r.id), true),
    done[0] ? rest<{ findings: { severity: Severity }[] | null }[]>(`scans?id=eq.${enc(done[0].id)}&select=findings:result->findings`).catch(() => []) : [],
  ]);
  const leadOf = new Map(leads.map((l) => [l.scan_id, l.email]));
  const scans = rows.map((r): AdminScanScore => {
    const m = mods.get(r.id)?.modules ?? null;
    return { id: r.id, at: r.created_at, status: r.status, error: r.error, email: (r.user_id && users.get(r.user_id)) || leadOf.get(r.id) || null, waiting: !!r.invite && !r.user_id, score: scoreOf(m), areas: Array.isArray(m) ? m.map((x) => ({ key: x.key, name: x.name, score: x.score })) : [] };
  });
  let latest: AdminHostDetail["latest"] = null;
  if (done[0]) {
    const issues: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
    for (const f of findings[0]?.findings ?? []) if (f.severity in issues) issues[f.severity]++;
    const v = mods.get(done[0].id)?.vitals;
    const run = v?.mobile ?? v?.desktop;
    latest = { id: done[0].id, issues, speed: v ? { mobile: v.mobile?.score ?? null, desktop: v.desktop?.score ?? null, lcp: v.field?.lcp ?? run?.lcp ?? null, cls: v.field?.cls ?? run?.cls ?? null, a11y: v.a11y ?? null } : null };
  }
  return { host, scans, latest };
}

/* ---------- scans an admin made to share ---------- */

export type AdminInvite = { id: string; host: string; url: string; at: string; status: Lite["status"]; error: string | null; score: number | null; openedAt: string | null; claimedAt: string | null; claimedBy: string | null };

/** `ready` is false until migration 0014 has been run. */
export async function adminInvites(): Promise<{ ready: boolean; invites: AdminInvite[] }> {
  if (!live()) return { ready: false, invites: [] };
  let rows: Lite[];
  try {
    rows = await rest<Lite[]>(`scans?invite=is.true&select=${LITE}${INVITE}&order=created_at.desc&limit=200`);
  } catch {
    return { ready: false, invites: [] };
  }
  const [users, mods] = await Promise.all([emailsById(), modulesFor(rows.filter((r) => r.status === "done").map((r) => r.id))]);
  return {
    ready: true,
    invites: rows.map((r) => ({ id: r.id, host: r.host, url: r.url, at: r.created_at, status: r.status, error: r.error, score: scoreOf(mods.get(r.id)?.modules), openedAt: r.opened_at ?? null, claimedAt: r.claimed_at ?? null, claimedBy: r.user_id ? (users.get(r.user_id) ?? r.user_id.slice(0, 8)) : null })),
  };
}
