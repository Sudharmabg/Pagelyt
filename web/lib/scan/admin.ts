import { runPrompts } from "../ai/run";
import { TOTAL_STAGES } from "./labels";
import { overallScore } from "./score";
import { createScan, live, rest, scheduleSiteScan, type Site } from "./store";
import { bumpAiSchedule, getSiteAi, listPrompts } from "./store-ext";
import type { ScanResult } from "./types";

/* Operator actions shared by the admin panel and the internal (cron) endpoints, plus the admin overview.
   Server only. Callers must have checked CRON_SECRET or adminFromRequest first: these act on any user's sites. */

/** Starts a scheduled-style rescan of a saved site. The caller then runs /api/scan/:id/step until done. */
export async function startSiteRescan(site: Site): Promise<{ id: string; total: number }> {
  const id = await createScan({ url: site.url, host: site.host, userId: site.user_id, siteId: site.id });
  await scheduleSiteScan(site, id); // moves next_run_at forward first, so a failed run is not retried every minute
  return { id, total: TOTAL_STAGES };
}

/** Runs the AI visibility check for one site. Null when the site is missing; throws when the run fails. */
export async function runSiteAi(siteId: string): Promise<{ runs: number; errors?: number; providers?: string[] } | null> {
  const site = await getSiteAi(siteId);
  if (!site) return null;
  await bumpAiSchedule(site.id); // first, so a failing run is not retried every minute
  const prompts = await listPrompts(site.id);
  if (!prompts.length) return { runs: 0 };
  return runPrompts(site, prompts);
}

/* ---------- overview ---------- */

export type AdminSite = {
  id: string;
  host: string;
  url: string;
  owner: string; // email when the auth admin API answers, else a short user id
  cadence: Site["cadence"];
  uptime: boolean;
  nextRunAt: string | null;
  due: boolean;
  lastScanId: string | null;
  lastScannedAt: string | null;
  score: number | null;
  ai: { track: boolean; nextRunAt: string | null; due: boolean; prompts: number; lastRunAt: string | null };
};

type SiteRow = Site & { last_scan_id: string | null; ai_track?: boolean; ai_next_run_at?: string | null };

export type AuthUserRow = { id: string; email?: string; created_at?: string; email_confirmed_at?: string | null; last_sign_in_at?: string | null };

/** Every account from the Supabase auth admin API (first 1000), or null when it is unavailable (e.g. the local mock). */
export async function authUsers(): Promise<AuthUserRow[] | null> {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    const j = (await r.json()) as { users?: AuthUserRow[] };
    return Array.isArray(j.users) ? j.users : null;
  } catch {
    return null;
  }
}

async function ownerEmails(): Promise<Map<string, string>> {
  return new Map((await authUsers() ?? []).filter((u) => u.email).map((u) => [u.id, u.email!]));
}

export async function adminOverview(): Promise<AdminSite[]> {
  if (!live()) return [];
  const sites = await rest<SiteRow[]>("sites?select=*&order=host.asc&limit=500");
  if (!sites.length) return [];
  const scanIds = sites.map((s) => s.last_scan_id).filter((x): x is string => !!x);
  const aiIds = sites.filter((s) => s.ai_track).map((s) => s.id);
  const inList = (ids: string[]) => `in.(${ids.map(encodeURIComponent).join(",")})`;

  const [emails, scans, prompts, runs] = await Promise.all([
    ownerEmails(),
    scanIds.length ? rest<{ id: string; created_at: string; status: string; modules: ScanResult["modules"] | null }[]>(`scans?id=${inList(scanIds)}&select=id,created_at,status,modules:result->modules`) : [],
    aiIds.length ? rest<{ site_id: string }[]>(`ai_prompts?site_id=${inList(aiIds)}&select=site_id`).catch(() => []) : [],
    aiIds.length ? rest<{ site_id: string; at: string }[]>(`ai_runs?site_id=${inList(aiIds)}&select=site_id,at&order=at.desc&limit=1000`).catch(() => []) : [],
  ]);
  const scanOf = new Map(scans.map((s) => [s.id, s]));
  const promptCount = new Map<string, number>();
  for (const p of prompts) promptCount.set(p.site_id, (promptCount.get(p.site_id) ?? 0) + 1);
  const lastRun = new Map<string, string>();
  for (const r of runs) if (!lastRun.has(r.site_id)) lastRun.set(r.site_id, r.at);

  const now = Date.now();
  const isDue = (at: string | null | undefined) => !!at && new Date(at).getTime() <= now;
  return sites.map((s) => {
    const scan = s.last_scan_id ? scanOf.get(s.last_scan_id) : undefined;
    return {
      id: s.id,
      host: s.host,
      url: s.url,
      owner: emails.get(s.user_id) ?? s.user_id.slice(0, 8),
      cadence: s.cadence,
      uptime: s.uptime,
      nextRunAt: s.next_run_at,
      due: s.cadence !== "none" && isDue(s.next_run_at),
      lastScanId: s.last_scan_id,
      lastScannedAt: scan?.created_at ?? null,
      score: scan?.status === "done" && scan.modules ? overallScore(scan.modules) : null,
      ai: { track: !!s.ai_track, nextRunAt: s.ai_next_run_at ?? null, due: !!s.ai_track && isDue(s.ai_next_run_at), prompts: promptCount.get(s.id) ?? 0, lastRunAt: lastRun.get(s.id) ?? null },
    };
  });
}

/* ---------- uptime ---------- */

/** Pings every site with uptime monitoring on (up to `limit`) and stores one uptime_checks row each. */
export async function pingUptime(limit = 40): Promise<{ checked: number; down: string[] }> {
  if (!live()) return { checked: 0, down: [] };
  const sites = await rest<{ id: string; host: string; url: string }[]>(`sites?uptime=eq.true&select=id,host,url&order=host.asc&limit=${limit}`);
  const rows: { site_id: string; ok: boolean; status: number | null; ms: number }[] = [];
  // Five at a time, so a slow site cannot hold the whole batch up for long.
  for (let i = 0; i < sites.length; i += 5) {
    rows.push(
      ...(await Promise.all(
        sites.slice(i, i + 5).map(async (s) => {
          const t = Date.now();
          try {
            const r = await fetch(s.url, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "user-agent": "PagelytUptime/1.0" } });
            return { site_id: s.id, ok: r.status < 400, status: r.status, ms: Date.now() - t };
          } catch {
            return { site_id: s.id, ok: false, status: null, ms: Date.now() - t };
          }
        })
      ))
    );
  }
  if (rows.length) await rest("uptime_checks", { method: "POST", prefer: "return=minimal", body: JSON.stringify(rows) });
  return { checked: rows.length, down: rows.filter((r) => !r.ok).map((r) => sites.find((s) => s.id === r.site_id)!.host) };
}
