import { findingKey, overallScore } from "./score";
import { live, rest, type ScanRow } from "./store";
import type { ScanResult } from "./types";

/* Server-side score history for a saved site: one compact snapshot per finished scan. */

export type Snap = { id: string; at: string; overall: number; mods: Record<string, number>; keys: string[]; highs: string[] };

export const toSnap = (id: string, r: ScanResult): Snap => ({
  id,
  at: r.scannedAt,
  overall: overallScore(r.modules),
  mods: Object.fromEntries(r.modules.map((m) => [m.key, m.score])),
  keys: r.findings.map(findingKey),
  highs: r.findings.filter((f) => f.severity === "high").map(findingKey),
});

/** Finished scans of the same site up to and including `scan`, oldest first (max `limit`). */
export async function siteHistory(scan: Pick<ScanRow, "id" | "site_id" | "user_id" | "host" | "created_at">, limit = 20): Promise<Snap[]> {
  if (!live()) return [];
  let filter: string;
  if (scan.site_id) filter = `site_id=eq.${encodeURIComponent(scan.site_id)}`;
  else if (scan.user_id) filter = `user_id=eq.${encodeURIComponent(scan.user_id)}&host=eq.${encodeURIComponent(scan.host)}`;
  else return []; // anonymous reports have no owner to group by
  const rows = await rest<{ id: string; result: ScanResult | null }[]>(
    `scans?${filter}&status=eq.done&created_at=lte.${encodeURIComponent(scan.created_at)}&select=id,result&order=created_at.desc&limit=${limit}`
  );
  return rows.filter((r) => r.result).map((r) => toSnap(r.id, r.result!)).reverse();
}

/** The scan before `scan` for the same site, or null. */
export async function previousSnap(scan: Pick<ScanRow, "id" | "site_id" | "created_at">): Promise<Snap | null> {
  if (!live() || !scan.site_id) return null;
  const rows = await rest<{ id: string; result: ScanResult | null }[]>(
    `scans?site_id=eq.${encodeURIComponent(scan.site_id)}&status=eq.done&id=neq.${encodeURIComponent(scan.id)}&created_at=lt.${encodeURIComponent(scan.created_at)}&select=id,result&order=created_at.desc&limit=1`
  );
  return rows[0]?.result ? toSnap(rows[0].id, rows[0].result) : null;
}
