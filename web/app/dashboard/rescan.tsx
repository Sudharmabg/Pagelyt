"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { beginScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";

/* Owner-only: starts a fresh scan of the same address and opens its dashboard, which shows the scan live. */
export function RescanButton({ url }: { url: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [err, setErr] = useState("");

  const go = async () => {
    const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
    if (!token) return setErr("Please sign in again.");
    setErr("");
    setLabel("Starting…");
    const r = await beginScan(url, token, { fresh: true });
    if ("error" in r) {
      setLabel("");
      return setErr(r.error);
    }
    router.push(`/dashboard/${r.id}`);
  };

  return (
    <>
      <button type="button" className="dash-btn" onClick={go} disabled={!!label} aria-live="polite">
        {label || "Rescan"}
      </button>
      {err && <span className="lm-err" role="alert">{err}</span>}
    </>
  );
}
