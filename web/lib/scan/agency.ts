import { live, newId, rest, type ScanRow } from "./store";
import { getPlan, type Brand, type Plan } from "./store-ext";
import { overallScore } from "./score";
import type { Finding, ModuleKey, ScanResult } from "./types";

/* Agency features: the account-type answer, paid-plan checks, the multi-site overview and comparisons.
   Server only. Every function that takes a user id must be called after the route has verified that user. */

export type AccountType = "agency" | "owner";

// Until Razorpay billing exists there is no way to buy a plan, so PAGELYT_OPEN_FEATURES=1 unlocks everything.
const open = () => process.env.PAGELYT_OPEN_FEATURES === "1";

/** Agency dashboard, server PDF and competitor comparisons are on every paid plan. */
export async function isPaid(userId: string): Promise<boolean> {
  return open() || (await getPlan(userId)) !== "free";
}

const memTypes = () => ((globalThis as unknown as { __pagelytTypes?: Map<string, AccountType> }).__pagelytTypes ??= new Map());

export async function getAccount(userId: string): Promise<{ plan: Plan; paid: boolean; accountType: AccountType | null }> {
  if (!live()) return { plan: "free", paid: open(), accountType: memTypes().get(userId) ?? null };
  // account_type needs migration 0006; before it has run, fall back to "not asked".
  const rows: { plan: Plan; account_type?: AccountType | null }[] = await rest<{ plan: Plan; account_type?: AccountType | null }[]>(`profiles?user_id=eq.${encodeURIComponent(userId)}&select=plan,account_type&limit=1`).catch(() =>
    rest<{ plan: Plan }[]>(`profiles?user_id=eq.${encodeURIComponent(userId)}&select=plan&limit=1`)
  );
  const plan = rows[0]?.plan ?? "free";
  return { plan, paid: open() || plan !== "free", accountType: rows[0]?.account_type ?? null };
}

export async function setAccountType(userId: string, type: AccountType): Promise<void> {
  if (!live()) {
    memTypes().set(userId, type);
    return;
  }
  // Upsert: a profile row may not exist yet. `plan` keeps its default (or current value) because it is not sent.
  await rest("profiles?on_conflict=user_id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: JSON.stringify({ user_id: userId, account_type: type }) });
}

/* ---------- Multi-site overview ---------- */

export type SiteSummary = {
  id: string;
  host: string;
  url: string;
  cadence: string;
  lastScanId: string | null;
  lastScannedAt: string | null;
  score: number | null;
  change: number | null; // vs the scan before
  weakest: { key: ModuleKey; score: number } | null;
  high: number; // open (not ticked as fixed) high-priority findings in the latest report
  open: number;
  trend: number[]; // oldest first, up to 10
};

type HistRow = { id: string; site_id: string | null; created_at: string; modules: ScanResult["modules"] | null };
type Latest = { id: string; created_at: string; modules: ScanResult["modules"] | null; findings: Finding[] | null; fixed?: string[] | null };

export async function sitesOverview(userId: string): Promise<SiteSummary[]> {
  if (!live()) return [];
  const uid = encodeURIComponent(userId);
  const sites = await rest<{ id: string; host: string; url: string; cadence: string; last_scan_id: string | null }[]>(`sites?user_id=eq.${uid}&select=id,host,url,cadence,last_scan_id&order=host.asc&limit=200`);
  if (!sites.length) return [];
  // Area scores only (small), for trends; findings only for each site's latest report.
  const hist = await rest<HistRow[]>(`scans?user_id=eq.${uid}&status=eq.done&site_id=not.is.null&select=id,site_id,created_at,modules:result->modules&order=created_at.desc&limit=600`);
  const bySite = new Map<string, HistRow[]>();
  for (const h of hist) if (h.site_id && h.modules) bySite.set(h.site_id, [...(bySite.get(h.site_id) ?? []), h]);
  const latestIds = sites.map((s) => bySite.get(s.id)?.[0]?.id ?? s.last_scan_id).filter((x): x is string => !!x);
  const latest = latestIds.length
    ? await rest<Latest[]>(`scans?id=in.(${latestIds.map(encodeURIComponent).join(",")})&select=id,created_at,modules:result->modules,findings:result->findings,fixed`).catch(() =>
        rest<Latest[]>(`scans?id=in.(${latestIds.map(encodeURIComponent).join(",")})&select=id,created_at,modules:result->modules,findings:result->findings`)
      )
    : [];
  const findingsOf = new Map(latest.map((l) => [l.id, l]));

  return sites.map((s) => {
    // Older reports saved before they were linked to the site: fall back to the site's latest report alone.
    const own = bySite.get(s.id) ?? [];
    const fb = !own.length && s.last_scan_id ? findingsOf.get(s.last_scan_id) : undefined;
    const rows: HistRow[] = own.length ? own : fb?.modules ? [{ id: fb.id, site_id: s.id, created_at: fb.created_at, modules: fb.modules }] : [];
    const scores = rows.map((r) => overallScore(r.modules!)); // newest first
    const lastId = rows[0]?.id ?? s.last_scan_id;
    const l = lastId ? findingsOf.get(lastId) : undefined;
    const fixed = new Set(l?.fixed ?? []);
    const openF = (l?.findings ?? []).filter((f) => !fixed.has(`${f.module}:${f.id}:${f.title}`));
    const weakest = rows[0]?.modules ? [...rows[0].modules].sort((a, b) => a.score - b.score)[0] : null;
    return {
      id: s.id,
      host: s.host,
      url: s.url,
      cadence: s.cadence,
      lastScanId: lastId,
      lastScannedAt: rows[0]?.created_at ?? null,
      score: scores[0] ?? null,
      change: scores.length > 1 ? scores[0] - scores[1] : null,
      weakest: weakest ? { key: weakest.key, score: weakest.score } : null,
      high: openF.filter((f) => f.severity === "high").length,
      open: openF.length,
      trend: scores.slice(0, 10).reverse(),
    };
  });
}

/** Marks a finished scan as the site's latest report (does not touch its schedule). */
export async function setSiteLastScan(siteId: string, scanId: string): Promise<void> {
  if (!live()) return;
  await rest(`sites?id=eq.${encodeURIComponent(siteId)}`, { method: "PATCH", body: JSON.stringify({ last_scan_id: scanId }), prefer: "return=minimal" });
}

/** The account's brand for PDFs (its first one), or null. */
export async function firstBrand(userId: string): Promise<Brand | null> {
  if (!live()) return null;
  return (await rest<Brand[]>(`brands?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.asc&limit=1`))[0] ?? null;
}

/* ---------- Comparisons ---------- */

export type Comparison = { id: string; user_id: string; scan_id: string; rival_ids: string[]; created_at: string };
const memCmp = () => ((globalThis as unknown as { __pagelytCmp?: Map<string, Comparison> }).__pagelytCmp ??= new Map());

export async function createComparison(userId: string, scanId: string, rivalIds: string[]): Promise<string> {
  const row: Comparison = { id: newId(), user_id: userId, scan_id: scanId, rival_ids: rivalIds, created_at: new Date().toISOString() };
  if (live()) await rest("comparisons", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
  else memCmp().set(row.id, row);
  return row.id;
}

export async function getComparison(id: string): Promise<Comparison | null> {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;
  if (!live()) return memCmp().get(id) ?? null;
  return (await rest<Comparison[]>(`comparisons?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))[0] ?? null;
}

export type { ScanRow };
