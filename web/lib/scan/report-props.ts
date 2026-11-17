import { emailsOn } from "../email";
import { siteHistory, type Snap } from "./history";
import { overallScore } from "./score";
import { getShots, type ScanRow, type StoredScan } from "./store";
import type { ModuleKey, ScanResult, Severity } from "./types";

/* What the dashboard needs to show a finished report. Server only. Shared by the report page and the admin's view
   of a shared scan nobody has claimed yet (GET /api/admin/report). */

export type ReportProps = {
  scan: StoredScan;
  history: Snap[];
  savedFixed: string[] | null;
  shots: { now: string | null; prev: string | null };
  canEmail: boolean;
};

export async function reportProps(row: ScanRow & { result: ScanResult }): Promise<ReportProps> {
  const history = await siteHistory(row).catch(() => []); // saved sites only; others use this browser's history
  // Reports saved before weighted scoring carry the old plain average; recompute so every view agrees.
  const result = { ...row.result, overall: overallScore(row.result.modules) };
  const prevId = result.change?.prevId;
  const shots = result.snapshot?.shot || prevId ? await getShots([row.id, ...(prevId ? [prevId] : [])]) : {};
  return {
    scan: { ...result, id: row.id },
    history,
    savedFixed: Array.isArray(row.fixed) ? row.fixed : null,
    shots: { now: shots[row.id] ?? null, prev: prevId ? (shots[prevId] ?? null) : null },
    canEmail: emailsOn(),
  };
}

/** The scores only, for a shared scan before anyone has signed in: no finding text leaves the server. */
export type Teaser = { overall: number; areas: { key: ModuleKey; score: number }[]; issues: Record<Severity, number> };

export function teaserOf(result: ScanResult): Teaser {
  const issues: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const f of result.findings) issues[f.severity]++;
  return { overall: overallScore(result.modules), areas: result.modules.map((m) => ({ key: m.key, score: m.score })), issues };
}
