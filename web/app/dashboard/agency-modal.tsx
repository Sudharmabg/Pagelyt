"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ModalX, onBackdrop } from "../modal-close";

/* Asked once, to the signed-in owner of a finished report: are you an agency?
   Agencies on a paid plan go to the agency dashboard; agencies on the free plan go to a consultation
   (there is no checkout yet, so an upgrade is arranged by hand). Site owners stay on their report. */

export type AccountInfo = { plan: string; paid: boolean; accountType: "agency" | "owner" | null };

async function token() {
  return (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
}

/** The signed-in user's plan and account type, or null while unknown / signed out. */
export function useAccount(enabled: boolean): [AccountInfo | null, (a: AccountInfo) => void] {
  const [acct, setAcct] = useState<AccountInfo | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void (async () => {
      const t = await token();
      if (!t) return;
      const r = await fetch("/api/account/type", { headers: { authorization: `Bearer ${t}` } }).catch(() => null);
      if (r?.ok && live) setAcct((await r.json()) as AccountInfo);
    })();
    return () => {
      live = false;
    };
  }, [enabled]);
  return [acct, setAcct];
}

export const AGENCY_UPSELL = "/consultation?topic=agency";

export function AgencyModal({ onAnswered }: { onAnswered: (a: AccountInfo) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const answer = async (type: "agency" | "owner") => {
    setBusy(true);
    setErr("");
    const t = await token();
    const r = t ? await fetch("/api/account/type", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ type }) }).catch(() => null) : null;
    if (!r?.ok) {
      setBusy(false);
      return setErr("We couldn't save that just now. Please try again.");
    }
    const a = (await r.json()) as AccountInfo;
    ref.current?.close();
    onAnswered(a);
    if (type === "agency") router.push(a.paid ? "/account/sites" : AGENCY_UPSELL);
  };

  return (
    // Closing (×, Esc or a click outside) counts as "ask me later": nothing is saved, so the question comes back next time.
    <dialog ref={ref} className="lead-modal agency-modal" aria-labelledby="agency-h" onCancel={(e) => busy && e.preventDefault()} onClick={(e) => !busy && onBackdrop(e, () => ref.current?.close())}>
      <ModalX onClick={() => ref.current?.close()} disabled={busy} label="Ask me later" />
      <div className="lm-body">
      <h2 id="agency-h">One quick question</h2>
      <p className="lm-sub">Are you an agency or freelancer managing websites for clients?</p>
      <p className="lm-fine">Agencies get a dashboard with every client site, score trends and bulk rescans on any paid plan.</p>
      {err && <p className="lm-err" role="alert">{err}</p>}
      <div className="lm-act">
        <button type="button" className="btn ghost" disabled={busy} onClick={() => answer("owner")}>No, it&rsquo;s my own site</button>
        <button type="button" className="btn" disabled={busy} onClick={() => answer("agency")} autoFocus>Yes, I&rsquo;m an agency</button>
      </div>
      </div>
    </dialog>
  );
}
