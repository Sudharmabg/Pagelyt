import type { ModuleKey } from "./scan/types";

/* Runs a full scan from the browser as a signed-in user, one stage per request (what keeps each request inside the
   Workers limits). Resolves to the new report's id, or an error message. */

/** What each step reports: the stage just finished and the areas whose score is already final. */
export type StepInfo = { stage: number; total: number; done: boolean; label: string; areas: { key: ModuleKey; score: number }[] };

/** Starts a scan without running it. The dashboard at /dashboard/<id> runs the stages and shows them live. */
export async function beginScan(url: string, token: string, opts: { siteId?: string; purpose?: "compare"; fresh?: boolean } = {}): Promise<{ id: string; done: boolean } | { error: string; code?: string }> {
  try {
    const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const start = (await (await fetch("/api/scan", { method: "POST", headers: auth, body: JSON.stringify({ url, siteId: opts.siteId, purpose: opts.purpose, fresh: opts.fresh }) })).json()) as { id?: string; done?: boolean; error?: string; code?: string };
    if (!start.id) return { error: start.error || "Scan failed.", code: start.code };
    return { id: start.id, done: !!start.done };
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }
}

export async function runScan(url: string, token: string, onStage?: (label: string, info: StepInfo) => void, opts: { siteId?: string; purpose?: "compare" } = {}): Promise<{ id: string } | { error: string; code?: string }> {
  const start = await beginScan(url, token, opts);
  if ("error" in start) return start;
  return start.done ? { id: start.id } : await stepScan(start.id, onStage);
}

/** Runs the remaining stages of a scan that has already been started. */
export async function stepScan(id: string, onStage?: (label: string, info: StepInfo) => void): Promise<{ id: string } | { error: string }> {
  try {
    for (;;) {
      const r = await fetch(`/api/scan/${id}/step`, { method: "POST" });
      const p = (await r.json()) as Partial<StepInfo> & { error?: string };
      if (!r.ok) return { error: p.error || "Scan failed." };
      if (p.label) onStage?.(p.label, { stage: p.stage ?? 0, total: p.total ?? 0, done: !!p.done, label: p.label, areas: p.areas ?? [] });
      if (p.done) return { id };
    }
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }
}
