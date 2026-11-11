"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { beginScan, stepScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";

async function token(): Promise<string | undefined> {
  return (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
}

/* Owner-only: scans the same address again while this report stays on screen. The new scan runs in the background
   (the button reads "Scanning…"); once it's done it is saved to the account (keeping the site's schedule and alerts)
   and the new report opens. `running`: a scan already started elsewhere (the home page sends ?scan=<id> here). */
export function RescanButton({ url, id, running }: { url: string; id: string; running?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ran = useRef<string | null>(null);

  const finish = async (scanId: string, t: string) => {
    await fetch("/api/account/claim", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ scanId }) }).catch(() => {});
    router.replace(`/dashboard/${scanId}`);
  };

  const run = async (scanId: string) => {
    if (ran.current === scanId) return;
    ran.current = scanId;
    setBusy(true);
    setErr("");
    const r = await stepScan(scanId);
    const t = await token();
    if ("error" in r || !t) {
      setBusy(false);
      setErr("error" in r ? r.error : "Please sign in again.");
      router.replace(`/dashboard/${id}`); // drop ?scan= so a reload doesn't retry a failed scan
      return;
    }
    await finish(scanId, t);
  };

  // A scan the home page started: run it here.
  useEffect(() => {
    if (!running) return;
    const tm = window.setTimeout(() => void run(running), 0);
    return () => window.clearTimeout(tm);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async () => {
    const t = await token();
    if (!t) return setErr("Please sign in again.");
    setErr("");
    setBusy(true);
    const r = await beginScan(url, t, { fresh: true });
    if ("error" in r) {
      setBusy(false);
      return setErr(r.error);
    }
    if (r.done) return finish(r.id, t);
    await run(r.id);
  };

  return (
    <>
      <button type="button" className="dash-btn" onClick={go} disabled={busy} aria-live="polite">
        {busy ? "Scanning…" : "Rescan"}
      </button>
      {err && <span className="lm-err" role="alert">{err}</span>}
    </>
  );
}
