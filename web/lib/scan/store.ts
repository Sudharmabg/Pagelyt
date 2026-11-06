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
export async function recentScanId(url: string, maxAgeSec: number): Promise<string | null> {
  const since = new Date(Date.now() - maxAgeSec * 1000).toISOString();
  if (!live()) {
    const hit = [...mem().scans.values()].filter((r) => r.url === url && r.status === "done" && r.created_at >= since).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return hit?.id ?? null;
  }
  const rows = await rest<{ id: string }[]>(`scans?url=eq.${encodeURIComponent(url)}&status=eq.done&created_at=gte.${encodeURIComponent(since)}&select=id&order=created_at.desc&limit=1`);
  return rows[0]?.id ?? null;
}

/** A finished report, or null if missing or still running. */
export async function getScan(id: string): Promise<StoredScan | null> {
  const row = await getScanRow(id);
  return row && row.status === "done" && row.result ? { ...row.result, id } : null;
}

/* ---------- leads ---------- */
export type Lead = { name: string; email: string; phone: string };

/** Returns an error message, or the normalised lead. */
export function validateLead(l: Partial<Lead> | undefined): { lead: Lead } | { error: string } {
  const name = String(l?.name ?? "").trim().replace(/\s+/g, " ");
  const email = String(l?.email ?? "").trim().toLowerCase();
  const phone = String(l?.phone ?? "").trim();
  if (name.length < 2 || name.length > 100) return { error: "Please enter your name." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Please enter a valid email address." };
  const digits = phone.replace(/\D/g, "");
  if (!/^[\d\s()+.-]+$/.test(phone) || digits.length < 7 || digits.length > 15) return { error: "Please enter a valid phone number." };
  return { lead: { name, email, phone } };
}

export async function saveLead(scanId: string, host: string, lead: Lead): Promise<void> {
  const row = { scan_id: scanId, host, ...lead, created_at: new Date().toISOString() };
  if (live()) await rest("leads", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
  else mem().leads.push(row);
}

/* ---------- rate limit ---------- */
/** True if the caller is within `limit` hits per `windowSec`. Records the hit. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  if (live()) {
    try {
      return await rest<boolean>("rpc/rate_limit_hit", { method: "POST", body: JSON.stringify({ p_key: key, p_limit: limit, p_window_seconds: windowSec }) });
    } catch {
      return true; // fail open: a limiter outage must not take scanning down
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
  const cadence = opts.cadence ?? "none";
  const rows = await rest<Site[]>("sites?on_conflict=user_id,host", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: JSON.stringify({ user_id: userId, host: scan.host, url: scan.url, cadence, uptime: !!opts.uptime, last_scan_id: scan.id, next_run_at: nextRun(cadence) }),
  });
  const site = rows[0];
  // Only claim an unowned scan; never take over someone else's report.
  await rest(`scans?id=eq.${encodeURIComponent(scan.id)}&user_id=is.null`, { method: "PATCH", body: JSON.stringify({ user_id: userId, site_id: site.id }), prefer: "return=minimal" });
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
