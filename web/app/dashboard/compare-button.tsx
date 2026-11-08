"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { runScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { AGENCY_UPSELL } from "./agency-modal";

/* Owner-only: scan up to three competitors and open a side-by-side comparison. Each competitor scan is a
   normal scan, so it counts against the same scan limit. Paid plans only (checked again on the server). */
export function CompareButton({ scanId, host, paid }: { scanId: string; host: string; paid: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState(["", "", ""]);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const busy = !!status;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
    if (!list.length) return setErr("Add at least one competitor’s website.");
    const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
    if (!token) return setErr("Please sign in again.");
    setErr("");
    const ids: string[] = [];
    for (const [i, u] of list.entries()) {
      setStatus(`Scanning competitor ${i + 1} of ${list.length}…`);
      const r = await runScan(u, token, (l) => setStatus(`Competitor ${i + 1} of ${list.length}: ${l}`));
      if ("error" in r) {
        setStatus("");
        return setErr(`${u}: ${r.error}`);
      }
      ids.push(r.id);
    }
    setStatus("Building the comparison…");
    const r = await fetch("/api/compare", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ scanId, rivalIds: ids }) }).catch(() => null);
    const j = r ? ((await r.json()) as { id?: string; error?: string }) : null;
    if (!j?.id) {
      setStatus("");
      return setErr(j?.error ?? "Could not build the comparison. Please try again.");
    }
    router.push(`/compare/${j.id}`);
  };

  return (
    <>
      <button type="button" className="dash-btn" onClick={() => setOpen(true)}>Compare competitors</button>
      <dialog ref={ref} className="lead-modal" aria-labelledby="cmp-h" onClose={() => setOpen(false)} onCancel={(e) => busy && e.preventDefault()}>
        {!paid ? (
          <div className="lm-body">
            <h2 id="cmp-h">Compare {host} with competitors</h2>
            <p className="lm-sub">Side-by-side competitor comparisons come with any paid plan.</p>
            <div className="lm-act">
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Close</button>
              <Link className="btn" href={AGENCY_UPSELL}>Talk to us about a plan</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={go} noValidate>
            <h2 id="cmp-h">Compare {host} with competitors</h2>
            <p className="lm-sub">Enter up to three competitor websites. We scan each one (about a minute each) and line them up against this report.</p>
            {urls.map((u, i) => (
              <label key={i}>
                Competitor {i + 1}{i > 0 ? " (optional)" : ""}
                <input type="url" inputMode="url" placeholder="https://competitor.com" value={u} disabled={busy} onChange={(e) => setUrls((x) => x.map((v, k) => (k === i ? e.target.value : v)))} />
              </label>
            ))}
            {status && <p className="lm-fine" role="status" aria-live="polite">{status}</p>}
            {err && <p className="lm-err" role="alert">{err}</p>}
            <p className="lm-fine">Each competitor scan counts towards your scan limit.</p>
            <div className="lm-act">
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn" disabled={busy}>{busy ? "Working…" : "Compare"}</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
