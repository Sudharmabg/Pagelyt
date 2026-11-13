"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { runScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { AGENCY_UPSELL } from "./agency-modal";

type Row = { url: string; state: "" | "scanning" | "done" | "error"; pct: number; label: string };
const blank = (): Row => ({ url: "", state: "", pct: 0, label: "" });
const hostOf = (u: string) => u.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

/* The dashboard's Compare competitors section, on the page itself: up to three competitor websites, each scanned
   in turn with its own progress, then a side-by-side comparison opens. Each competitor scan is a normal scan, so it
   counts against the same scan limit. Paid plans only (checked again on the server). */
export function CompareButton({ scanId, host, paid, overall, modules }: { scanId: string; host: string; paid: boolean; overall: number; modules: { key: string; name: string; score: number }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([blank(), blank(), blank()]);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const busy = !!status;
  const set = (i: number, p: Partial<Row>) => setRows((x) => x.map((r, k) => (k === i ? { ...r, ...p } : r)));

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paid || busy) return;
    const seen = new Set<string>();
    const todo = rows.map((r, i) => ({ i, u: r.url.trim() })).filter(({ u }) => u && !seen.has(u.toLowerCase()) && seen.add(u.toLowerCase()));
    if (!todo.length) return setErr("Add at least one competitor’s website.");
    const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
    if (!token) return setErr("Please sign in again.");
    setErr("");
    setRows((x) => x.map((r) => ({ ...r, state: "", pct: 0, label: "" })));
    const ids: string[] = [];
    for (const [n, { i, u }] of todo.entries()) {
      setStatus(`Scanning competitor ${n + 1} of ${todo.length}…`);
      set(i, { state: "scanning", pct: 4, label: "Starting…" });
      const r = await runScan(u, token, (l, info) => set(i, { label: l, pct: info.total ? Math.max(4, Math.round((info.stage / info.total) * 100)) : 10 }), { purpose: "compare" });
      if ("error" in r) {
        set(i, { state: "error", label: r.error });
        setStatus("");
        return setErr(`${hostOf(u)}: ${r.error}`);
      }
      set(i, { state: "done", pct: 100, label: "Scanned" });
      ids.push(r.id);
    }
    setStatus("Building the comparison…");
    const r = await fetch("/api/compare", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ scanId, rivalIds: ids }) }).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { id?: string; error?: string }) : null;
    if (!j?.id) {
      setStatus("");
      return setErr(j?.error ?? "Could not build the comparison. Please try again.");
    }
    router.push(`/compare/${j.id}`);
  };

  const filled = rows.filter((r) => r.url.trim()).length;

  return (
    <div className="rv">
      <form className="panel rv-form" onSubmit={go} noValidate>
        <div className="rv-you">
          <span className="rv-badge">You</span>
          <b>{host}</b>
          <span className="rv-score">{overall}<small>/100</small></span>
        </div>
        <p className="rv-vs" aria-hidden="true"><span>vs</span></p>
        {rows.map((r, i) => (
          <div key={i} className={`rv-row ${r.state}`}>
            <label>
              <span className="rv-n">{i + 1}</span>
              <span className="sr-only">Competitor {i + 1}{i > 0 ? " (optional)" : ""}</span>
              <input type="url" inputMode="url" placeholder={i === 0 ? "https://competitor.com" : "Another competitor (optional)"} value={r.url} disabled={busy || !paid} onChange={(e) => set(i, { url: e.target.value, state: "", label: "" })} />
              {r.state === "done" && <span className="rv-st ok" aria-label="Scanned">✓</span>}
              {r.state === "error" && <span className="rv-st bad" aria-label="Failed">!</span>}
            </label>
            {r.state === "scanning" && (
              <div className="rv-prog" role="progressbar" aria-label={`Scanning ${hostOf(r.url)}`} aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100}>
                <span className="rv-bar"><i style={{ width: `${r.pct}%` }} /></span>
                <small>{r.label}</small>
              </div>
            )}
          </div>
        ))}
        {status && <p className="rv-status" role="status" aria-live="polite"><span className="live-spin" aria-hidden="true" />{status}</p>}
        {err && <p className="lm-err" role="alert">{err}</p>}
        {paid ? (
          <div className="rv-act">
            <button type="submit" className="dash-btn primary" disabled={busy || !filled}>{busy ? "Working…" : filled > 1 ? `Compare with ${filled} competitors` : "Compare"}</button>
            <small>About a minute per competitor. Each one counts towards your scan limit.</small>
          </div>
        ) : (
          <div className="rv-up">
            <p><b>Competitor comparisons come with any paid plan.</b> See exactly where rivals beat {host}, area by area.</p>
            <Link className="dash-btn primary" href={AGENCY_UPSELL}>Talk to us about a plan</Link>
          </div>
        )}
      </form>

      <aside className="panel rv-prev" aria-label="What the comparison shows">
        <p className="rv-prev-h">What you&rsquo;ll get</p>
        <p className="rv-prev-s">Every area side by side, with who leads each one and the gaps worth closing first.</p>
        <ul className="rv-mini">
          {modules.map((m, i) => (
            <li key={m.key}>
              <span className="rv-mini-n">{m.name}</span>
              <span className="rv-mini-bars">
                <i className="rv-you" style={{ width: `${Math.max(4, m.score)}%` }} title={`${host}: ${m.score}`} />
                <i className="rv-them" style={{ width: `${30 + ((i * 37) % 55)}%` }} aria-hidden="true" />
              </span>
              <b>{m.score}</b>
            </li>
          ))}
        </ul>
        <p className="rv-legend"><span><i className="rv-you" />{host}</span><span><i className="rv-them" />Competitors, once scanned</span></p>
      </aside>
    </div>
  );
}
