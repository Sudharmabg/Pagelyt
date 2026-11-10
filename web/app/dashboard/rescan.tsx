"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { beginScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";

/* Owner-only: starts a fresh scan of the same address and opens its dashboard, which shows the scan live and,
   when it finishes, saves it to the account (keeping the site's schedule and alerts). */
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
    // ?new=1: the live dashboard saves the finished scan to the account, which also makes it the saved site's latest.
    if (r.done) await fetch("/api/account/claim", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ scanId: r.id }) }).catch(() => {});
    router.push(`/dashboard/${r.id}${r.done ? "" : "?new=1"}`);
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
