/* Runs a full scan from the browser as a signed-in user, one stage per request (what keeps each request inside the
   Workers limits). Resolves to the new report's id, or an error message. */
export async function runScan(url: string, token: string, onStage?: (label: string) => void, opts: { siteId?: string } = {}): Promise<{ id: string } | { error: string }> {
  try {
    const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const start = (await (await fetch("/api/scan", { method: "POST", headers: auth, body: JSON.stringify({ url, siteId: opts.siteId }) })).json()) as { id?: string; done?: boolean; error?: string };
    if (!start.id) return { error: start.error || "Scan failed." };
    return start.done ? { id: start.id } : await stepScan(start.id, onStage);
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }
}

/** Runs the remaining stages of a scan that has already been started. */
export async function stepScan(id: string, onStage?: (label: string) => void): Promise<{ id: string } | { error: string }> {
  try {
    for (;;) {
      const r = await fetch(`/api/scan/${id}/step`, { method: "POST" });
      const p = (await r.json()) as { done?: boolean; label?: string; error?: string };
      if (!r.ok) return { error: p.error || "Scan failed." };
      if (p.label) onStage?.(p.label);
      if (p.done) return { id };
    }
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }
}
