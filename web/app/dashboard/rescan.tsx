"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { runScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";

/* Owner-only: scans the same address again and opens the fresh report. */
export function RescanButton({ url }: { url: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");

  const go = async () => {
    const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
    if (!token) return setErr("Please sign in again.");
    setErr("");
    setLabel("Starting…");
    const r = await runScan(url, token, (l) => setLabel(l));
    if ("error" in r) {
      setLabel("");
      return setErr(r.error);
    }
    router.push(`/dashboard/${r.id}`);
    router.refresh();
  };

  return (
    <>
      <button type="button" className="dash-btn" onClick={go} disabled={!!label} aria-live="polite">
        {label ? `Scanning: ${label}` : "Rescan"}
      </button>
      {err && <span className="lm-err" role="alert">{err}</span>}
    </>
  );
}
