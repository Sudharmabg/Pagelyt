/* Runs a full scan from the browser as a signed-in user, one stage per request (what keeps each request inside the
   Workers limits). Resolves to the new report's id, or an error message. */
export async function runScan(url: string, token: string, onStage?: (label: string) => void, opts: { siteId?: string } = {}): Promise<{ id: string } | { error: string }> {
  try {
    const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const start = (await (await fetch("/api/scan", { method: "POST", headers: auth, body: JSON.stringify({ url, siteId: opts.siteId }) })).json()) as { id?: string; done?: boolean; error?: string };
    if (!start.id) return { error: start.error || "Scan failed." };
    let done = !!start.done;
    while (!done) {
      const r = await fetch(`/api/scan/${start.id}/step`, { method: "POST" });
      const p = (await r.json()) as { done?: boolean; label?: string; error?: string };
      if (!r.ok) return { error: p.error || "Scan failed." };
      if (p.label) onStage?.(p.label);
      done = !!p.done;
    }
    return { id: start.id };
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }
}
