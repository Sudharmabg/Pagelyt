import { live, newId, rest, getScanRow, type ScanRow } from "./store";

/* Server-side data access for white-label sharing and AI visibility. Everything here needs Supabase
   (callers check `live()` first). The service-role key bypasses RLS, so every function that takes a
   user id must be called only after the route has verified that user. */

export type Plan = "free" | "essential" | "professional" | "business";

export async function getPlan(userId: string): Promise<Plan> {
  if (!live()) return "free";
  const rows = await rest<{ plan: Plan }[]>(`profiles?user_id=eq.${encodeURIComponent(userId)}&select=plan&limit=1`);
  return rows[0]?.plan ?? "free";
}

// Until Razorpay billing exists there is no way to buy a plan, so PAGELYT_OPEN_FEATURES=1 unlocks everything.
const open = () => process.env.PAGELYT_OPEN_FEATURES === "1";
export async function canWhiteLabel(userId: string) {
  return open() || (await getPlan(userId)) === "business";
}
export async function canTrackAi(userId: string) {
  return open() || ["professional", "business"].includes(await getPlan(userId));
}

/* ---------- brands and shared reports ---------- */
export type Brand = { id: string; user_id: string; name: string; logo_url: string | null; color: string; website: string | null; contact_email: string | null; footer: string | null; show_powered_by: boolean };
export type Share = { token: string; scan_id: string; user_id: string; brand_id: string | null; show_details: boolean; include_ai: boolean; revoked: boolean; expires_at: string | null; created_at: string };

export async function getBrand(id: string, userId?: string): Promise<Brand | null> {
  const q = `brands?id=eq.${encodeURIComponent(id)}${userId ? `&user_id=eq.${encodeURIComponent(userId)}` : ""}&select=*&limit=1`;
  return (await rest<Brand[]>(q))[0] ?? null;
}

export async function createShare(o: { scanId: string; userId: string; brandId: string | null; showDetails: boolean; includeAi: boolean; expiresInDays?: number }): Promise<Share> {
  const row = {
    token: newId() + newId().slice(0, 6), // ~120 bits
    scan_id: o.scanId,
    user_id: o.userId,
    brand_id: o.brandId,
    show_details: o.showDetails,
    include_ai: o.includeAi,
    expires_at: o.expiresInDays ? new Date(Date.now() + o.expiresInDays * 86_400_000).toISOString() : null,
  };
  return (await rest<Share[]>("shared_reports", { method: "POST", prefer: "return=representation", body: JSON.stringify(row) }))[0];
}

export async function getShare(token: string): Promise<Share | null> {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return null;
  const s = (await rest<Share[]>(`shared_reports?token=eq.${encodeURIComponent(token)}&select=*&limit=1`))[0];
  if (!s || s.revoked || (s.expires_at && new Date(s.expires_at) < new Date())) return null;
  return s;
}

export async function loadSharedReport(token: string) {
  if (!live()) return null;
  const share = await getShare(token);
  if (!share) return null;
  const [scan, brand] = await Promise.all([getScanRow(share.scan_id), share.brand_id ? getBrand(share.brand_id, share.user_id) : Promise.resolve(null)]);
  if (!scan || scan.status !== "done" || !scan.result) return null;
  return { share, brand, scan: scan as ScanRow & { result: NonNullable<ScanRow["result"]> } };
}

/* ---------- AI visibility ---------- */
export type SiteAi = { id: string; user_id: string; host: string; url: string; brand_terms: string[]; competitors: string[]; ai_track: boolean };
export type Prompt = { id: string; site_id: string; prompt: string };
export type AiRun = { id: number; site_id: string; prompt_id: string; provider: string; at: string; mentioned: boolean; cited: boolean; position: number | null; competitor_counts: Record<string, number>; answer: string | null; citations: string[]; error: string | null };

export async function getSiteAi(siteId: string, userId?: string): Promise<SiteAi | null> {
  const q = `sites?id=eq.${encodeURIComponent(siteId)}${userId ? `&user_id=eq.${encodeURIComponent(userId)}` : ""}&select=id,user_id,host,url,brand_terms,competitors,ai_track&limit=1`;
  return (await rest<SiteAi[]>(q))[0] ?? null;
}

export async function listPrompts(siteId: string): Promise<Prompt[]> {
  return rest<Prompt[]>(`ai_prompts?site_id=eq.${encodeURIComponent(siteId)}&select=id,site_id,prompt&order=created_at.asc`);
}

export async function insertRuns(rows: Omit<AiRun, "id" | "at">[]): Promise<void> {
  if (rows.length) await rest("ai_runs", { method: "POST", prefer: "return=minimal", body: JSON.stringify(rows) });
}

export async function recentRuns(siteId: string, limit = 300): Promise<AiRun[]> {
  return rest<AiRun[]>(`ai_runs?site_id=eq.${encodeURIComponent(siteId)}&select=*&order=at.desc&limit=${limit}`);
}

export async function dueAiSites(limit: number): Promise<{ id: string }[]> {
  const now = encodeURIComponent(new Date().toISOString());
  return rest<{ id: string }[]>(`sites?ai_track=eq.true&ai_next_run_at=lte.${now}&select=id&order=ai_next_run_at.asc&limit=${limit}`);
}

export async function bumpAiSchedule(siteId: string): Promise<void> {
  const next = new Date(Date.now() + 7 * 86_400_000).toISOString();
  await rest(`sites?id=eq.${encodeURIComponent(siteId)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ ai_next_run_at: next }) });
}
