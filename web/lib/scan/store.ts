import { checkLead, type NewLead } from "../validate";
import type { ScanResult } from "./types";

/* Storage for scans and leads.

   Production: Supabase Postgres through PostgREST with the service-role key (server only, never sent
   to the browser). Row-level security is on, so the browser's anon key cannot read these tables.
   Development without Supabase env vars: an in-memory store, so `npm run dev` works with no setup
   (data is lost on restart). See supabase/migrations for the schema. */

export type StoredScan = ScanResult & { id: string };
export type ScanStatus = "running" | "done" | "failed";

export type ScanRow = {
  id: string;
  url: string;
  host: string;
  status: ScanStatus;
  stage: number;
  state: Record<string, unknown>;
  result: ScanResult | null;
  error: string | null;
  user_id: string | null;
  site_id: string | null;
  created_at: string;
  /** Finding keys the owner has marked as fixed (needs migration 0004; undefined before it has run). */
  fixed?: string[];
};

const URL_ = () => process.env.SUPABASE_URL;
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const live = () => !!(URL_() && KEY());

/* ---------- tiny PostgREST client ---------- */
export async function rest<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const { prefer, ...rest } = init;
  const res = await fetch(`${URL_()}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: KEY()!,
      authorization: `Bearer ${KEY()}`,
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
      ...(rest.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/* ---------- dev fallback ---------- */
type Mem = { scans: Map<string, ScanRow>; leads: unknown[]; hits: Map<string, number[]> };
const g = globalThis as unknown as { __pagelytMem?: Mem };
const mem = (): Mem => (g.__pagelytMem ??= { scans: new Map(), leads: [], hits: new Map() });

export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(9)); // 72 bits: unguessable, URL-safe
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const validId = (id: string) => /^[A-Za-z0-9_-]{6,32}$/.test(id);

/* ---------- scans ---------- */
export async function createScan(init: { url: string; host: string; userId?: string | null; siteId?: string | null }): Promise<string> {
  const row: ScanRow = { id: newId(), url: init.url, host: init.host, status: "running", stage: 0, state: {}, result: null, error: null, user_id: init.userId ?? null, site_id: init.siteId ?? null, created_at: new Date().toISOString() };
  if (live()) await rest("scans", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
  else mem().scans.set(row.id, row);
  return row.id;
}

export async function getScanRow(id: string): Promise<ScanRow | null> {
  if (!validId(id)) return null;
  if (!live()) return mem().scans.get(id) ?? null;
  const rows = await rest<ScanRow[]>(`scans?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  return rows[0] ?? null;
}

export async function updateScan(id: string, patch: Partial<Pick<ScanRow, "status" | "stage" | "state" | "result" | "error" | "host">>): Promise<void> {
  if (!live()) {
    const cur = mem().scans.get(id);
    if (cur) mem().scans.set(id, { ...cur, ...patch });
    return;
  }
  await rest(`scans?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch), prefer: "return=minimal" });
}

/** Newest finished scan of this exact URL within `maxAgeSec`, so repeat scans are free. */
export async function recentScanId(url: string, maxAgeSec: number, userId?: string | null): Promise<string | null> {
  const since = new Date(Date.now() - maxAgeSec * 1000).toISOString();
  if (!live()) {
    const hit = [...mem().scans.values()].filter((r) => r.url === url && r.status === "done" && r.created_at >= since).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return hit?.id ?? null;
  }
  // With accounts, a report is only ever reused by its own owner. Handing someone else's report to a new visitor
  // would leave them as a view-only guest on what should be their own scan.
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const rows = await rest<{ id: string }[]>(`scans?url=eq.${encodeURIComponent(url)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.done&created_at=gte.${encodeURIComponent(since)}&select=id&order=created_at.desc&limit=1`);
  return rows[0]?.id ?? null;
}

/** A finished report, or null if missing or still running. */
export async function getScan(id: string): Promise<StoredScan | null> {
  const row = await getScanRow(id);
  return row && row.status === "done" && row.result ? { ...row.result, id } : null;
}

/* ---------- screenshots (migration 0005; kept out of `scans` so normal row reads stay small) ---------- */
const shots = () => ((g as unknown as { __pagelytShots?: Map<string, string> }).__pagelytShots ??= new Map());

/** Best-effort: a missing table (migration not run) just means no screenshots. */
export async function saveShot(scanId: string, data: string): Promise<void> {
  if (!live()) {
    shots().set(scanId, data);
    return;
  }
  await rest("scan_shots", { method: "POST", body: JSON.stringify({ scan_id: scanId, data }), prefer: "resolution=merge-duplicates,return=minimal" }).catch(() => {});
}

export async function getShots(ids: string[]): Promise<Record<string, string>> {
  const valid = ids.filter(validId);
  if (!valid.length) return {};
  if (!live()) return Object.fromEntries(valid.filter((i) => shots().has(i)).map((i) => [i, shots().get(i)!]));
  try {
    const rows = await rest<{ scan_id: string; data: string }[]>(`scan_shots?scan_id=in.(${valid.map(encodeURIComponent).join(",")})&select=scan_id,data`);
    return Object.fromEntries(rows.map((r) => [r.scan_id, r.data]));
  } catch {
    return {};
  }
}

/** Newest finished scan of the same site (or owner + host) before `scan`, with its stored result. */
export async function previousResult(scan: Pick<ScanRow, "id" | "site_id" | "user_id" | "host" | "created_at">): Promise<{ id: string; result: ScanResult } | null> {
  if (!live()) {
    const hit = [...mem().scans.values()].filter((r) => r.id !== scan.id && r.status === "done" && r.result && r.host === scan.host && r.created_at < scan.created_at).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return hit ? { id: hit.id, result: hit.result! } : null;
  }
  let filter: string;
  if (scan.site_id) filter = `site_id=eq.${encodeURIComponent(scan.site_id)}`;
  else if (scan.user_id) filter = `user_id=eq.${encodeURIComponent(scan.user_id)}&host=eq.${encodeURIComponent(scan.host)}`;
  else return null; // anonymous scans have no owner to group by
  const rows = await rest<{ id: string; result: ScanResult | null }[]>(
    `scans?${filter}&status=eq.done&id=neq.${encodeURIComponent(scan.id)}&created_at=lt.${encodeURIComponent(scan.created_at)}&select=id,result&order=created_at.desc&limit=1`
  );
  return rows[0]?.result ? { id: rows[0].id, result: rows[0].result } : null;
}

/* ---------- leads ---------- */
export type Lead = NewLead;

/** Returns an error message, or the normalised lead. The rules live in lib/validate.ts (shared with the browser). */
export function validateLead(l: Partial<Lead> | undefined): { lead: Lead } | { error: string } {
  return checkLead(l);
}

export async function saveLead(scanId: string, host: string, lead: Lead): Promise<void> {
  const row = { scan_id: scanId, host, ...lead, created_at: new Date().toISOString() };
  if (live()) await rest("leads", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
  else mem().leads.push(row);
}

/** After an address is verified, attach the scans started with that address (as a lead) to the account.
    At most the 5 newest are claimed, and a scan that already has an owner is never taken over.
    Returns the ids of the person's finished scans, newest first. Needs Supabase; memory mode has no accounts. */
export async function claimScansByEmail(userId: string, email: string): Promise<string[]> {
  if (!live()) return [];
  const leads = await rest<{ scan_id: string }[]>(`leads?email=eq.${encodeURIComponent(email)}&select=scan_id&order=created_at.desc&limit=5`);
  const ids = [...new Set(leads.map((l) => l.scan_id).filter(validId))];
  if (!ids.length) return [];
  const list = ids.join(",");
  const rows = await rest<{ id: string; user_id: string | null; status: ScanStatus }[]>(`scans?id=in.(${list})&select=id,user_id,status&order=created_at.desc`);
  if (rows.some((r) => !r.user_id)) {
    await rest(`scans?id=in.(${list})&user_id=is.null`, { method: "PATCH", body: JSON.stringify({ user_id: userId }), prefer: "return=minimal" });
  }
  return rows.filter((r) => (!r.user_id || r.user_id === userId) && r.status === "done").map((r) => r.id);
}

/** Saves which findings the owner has marked as fixed. Needs Supabase; memory mode keeps this in the browser instead. */
export async function setScanFixed(id: string, fixed: string[]): Promise<void> {
  if (!live() || !validId(id)) return;
  await rest(`scans?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ fixed }), prefer: "return=minimal" });
}

/** The account's newest finished report, if it has one. */
export async function latestScanForUser(userId: string): Promise<ScanRow | null> {
  if (!live() || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const rows = await rest<ScanRow[]>(`scans?user_id=eq.${encodeURIComponent(userId)}&status=eq.done&order=created_at.desc&limit=1&select=*`);
  return rows[0] ?? null;
}

/** The signed-in person's newest finished report of one website, if any (shown while a rescan runs). */
export async function latestScanForHost(userId: string, host: string): Promise<string | null> {
  if (!live() || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const rows = await rest<{ id: string }[]>(`scans?user_id=eq.${encodeURIComponent(userId)}&host=eq.${encodeURIComponent(host)}&status=eq.done&result=not.is.null&order=created_at.desc&limit=1&select=id`);
  return rows[0]?.id ?? null;
}

/* ---------- rate limit ---------- */
/** True if the caller is within `limit` hits per `windowSec`. Records the hit.
    If the limiter itself is down it lets the request through, unless `failClosed` is set (used for sign-in and
    sign-up, where an outage must not turn into unlimited password guessing). */
export async function rateLimit(key: string, limit: number, windowSec: number, opts: { failClosed?: boolean } = {}): Promise<boolean> {
  if (live()) {
    try {
      return await rest<boolean>("rpc/rate_limit_hit", { method: "POST", body: JSON.stringify({ p_key: key, p_limit: limit, p_window_seconds: windowSec }) });
    } catch {
      return !opts.failClosed;
    }
  }
  const now = Date.now();
  const recent = (mem().hits.get(key) ?? []).filter((t) => now - t < windowSec * 1000);
  if (recent.length >= limit) return false;
  mem().hits.set(key, [...recent, now]);
  return true;
}

/* ---------- saved sites (needs Supabase; no-ops in memory mode) ---------- */
export type Site = { id: string; user_id: string; host: string; url: string; cadence: "none" | "daily" | "weekly" | "monthly"; uptime: boolean; alerts?: boolean; next_run_at: string | null };

const STEP = { daily: 1, weekly: 7, monthly: 30 } as const;
export const nextRun = (cadence: Site["cadence"], from = Date.now()) =>
  cadence === "none" ? null : new Date(from + STEP[cadence] * 86_400_000).toISOString();

/** Save (or update) a site for a user and attach the scan to it. Returns the site, or null in memory mode. */
export async function saveSite(userId: string, scan: { id: string; host: string; url: string }, opts: { cadence?: Site["cadence"]; uptime?: boolean }): Promise<Site | null> {
  if (!live()) return null;
  // Only send the schedule and uptime when the caller chose them. A plain "save this report" (after a signed-in
  // scan or a rescan) must keep an existing site's settings; a new site gets the table defaults (none, off).
  const settings = {
    ...(opts.cadence !== undefined ? { cadence: opts.cadence, next_run_at: nextRun(opts.cadence) } : {}),
    ...(opts.uptime !== undefined ? { uptime: opts.uptime } : {}),
  };
  const rows = await rest<Site[]>("sites?on_conflict=user_id,host", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: JSON.stringify({ user_id: userId, host: scan.host, url: scan.url, last_scan_id: scan.id, ...settings }),
  });
  const site = rows[0];
  // Claim an unowned scan, or link the user's own scan to the site; never take over someone else's report.
  const sid = encodeURIComponent(scan.id);
  await rest(`scans?id=eq.${sid}&user_id=is.null`, { method: "PATCH", body: JSON.stringify({ user_id: userId, site_id: site.id }), prefer: "return=minimal" });
  await rest(`scans?id=eq.${sid}&user_id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ site_id: site.id }), prefer: "return=minimal" });
  return site;
}

export async function dueSites(limit: number): Promise<Site[]> {
  if (!live()) return [];
  const now = encodeURIComponent(new Date().toISOString());
  return rest<Site[]>(`sites?cadence=neq.none&next_run_at=lte.${now}&select=*&order=next_run_at.asc&limit=${limit}`);
}

export async function getSite(id: string): Promise<Site | null> {
  if (!live()) return null;
  const rows = await rest<Site[]>(`sites?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  return rows[0] ?? null;
}

export async function scheduleSiteScan(site: Site, scanId: string): Promise<void> {
  if (!live()) return;
  await rest(`sites?id=eq.${encodeURIComponent(site.id)}`, { method: "PATCH", body: JSON.stringify({ last_scan_id: scanId, next_run_at: nextRun(site.cadence) }), prefer: "return=minimal" });
}

export const storeMode = () => (live() ? "supabase" : "memory");
