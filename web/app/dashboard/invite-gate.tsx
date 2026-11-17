"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReportProps, Teaser } from "@/lib/scan/report-props";
import { MODULE_NAMES } from "@/lib/scan/types";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useSignedInUser } from "@/lib/use-signed-in";
import { AuthLink } from "../auth-link";
import { LeadModal } from "../lead-modal";
import { PageLoader } from "../page-loader";
import { Ring, tone } from "../ui";
import { Dashboard } from "./dashboard";
import { AreaIcon } from "./icons";

/* A scan an admin made to share (admin Scan tab), before anyone has signed in to it. The server sends only the
   scores, so this page shows them and asks the visitor to sign in. The first person to sign in gets the report
   (POST /api/scan/:id/invite) and the page reloads as their normal dashboard. An admin sees the whole report here
   without taking it. */

type State = "checking" | "signin" | "opening" | "admin";

export function InviteGate({ id, host, teaser }: { id: string; host: string; teaser: Teaser }) {
  const router = useRouter();
  const user = useSignedInUser();
  const uid = user === undefined ? undefined : (user?.id ?? null);
  const [state, setState] = useState<State>("checking");
  const [report, setReport] = useState<ReportProps | null>(null);
  const [modal, setModal] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (uid === undefined) return;
    let live = true;
    (async () => {
      const token = uid ? (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token : undefined;
      const auth: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
      const r = (await fetch(`/api/scan/${id}/invite`, { method: "POST", headers: auth }).then((x) => x.json()).catch(() => ({}))) as { state?: string; error?: string };
      if (!live) return;
      if (r.state === "yours" || r.state === "taken") {
        setState("opening");
        return router.refresh(); // the server now sends the full report
      }
      if (r.state === "admin") {
        const full = (await fetch(`/api/admin/report?id=${encodeURIComponent(id)}`, { headers: auth }).then((x) => (x.ok ? x.json() : null)).catch(() => null)) as ReportProps | null;
        if (!live) return;
        if (full) {
          setReport(full);
          return setState("admin");
        }
      }
      setNote(r.state === "unverified" ? "Confirm your email address first, then open this link again." : uid ? (r.error ?? "We couldn’t open the report. Please refresh the page.") : "");
      setState("signin");
    })();
    return () => {
      live = false;
    };
  }, [id, uid, router]);

  if (state === "admin" && report) {
    return (
      <>
        <Dashboard {...report} />
        <p className="inv-admin" role="status">Admin view. Nobody has signed in to this report yet.</p>
      </>
    );
  }

  const total = teaser.issues.high + teaser.issues.medium + teaser.issues.low;
  const busy = state === "checking" || state === "opening";

  return (
    <div className="dash live inv">
      <header className="dash-top">
        <Link href="/" className="dash-logo" aria-label="Pagelyt home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Pagelyt" width={140} height={30} />
        </Link>
        <div className="dash-site">
          <strong>{host}</strong>
          <span>Report ready</span>
        </div>
        <AuthLink compact />
      </header>

      <div className="dash-body">
        <nav className="dash-nav" aria-label="Areas checked">
          <p className="nav-h">Areas</p>
          {teaser.areas.map((a) => (
            <button key={a.key} type="button" disabled className="live-done">
              <span className="nv"><AreaIcon k={a.key} />{MODULE_NAMES[a.key]}</span>
              <b className={`t-${tone(a.score)}`}>{a.score}</b>
            </button>
          ))}
        </nav>

        <main className="dash-main">
          <section className="dash-hero" aria-label="Website score">
            <Ring v={teaser.overall} size={132} stroke={13} text={String(teaser.overall)} />
            <div className="dash-hero-txt">
              <p className="dash-eyebrow">Website Intelligence Score</p>
              <h1>The report for {host} is ready</h1>
              {state === "opening" ? (
                <PageLoader text="Opening your report…" />
              ) : (
                <>
                  <p>
                    We checked {host} in {teaser.areas.length} areas and found <strong>{total} issue{total === 1 ? "" : "s"}</strong>
                    {teaser.issues.high > 0 && <>, {teaser.issues.high} of them high priority</>}. Sign in to see each one, why it matters and how to fix it.
                  </p>
                  {note && <p className="lm-note" role="status">{note}</p>}
                  <p className="inv-cta">
                    <button type="button" className="btn" disabled={busy || !!uid} onClick={() => setModal(true)}>
                      {state === "checking" ? "Checking…" : "Sign in to see the full report"}
                    </button>
                    <span className="panel-note">Free. It takes a minute.</span>
                  </p>
                </>
              )}
            </div>
          </section>

          <ul className="dash-cards" aria-label="Scores by area">
            {teaser.areas.map((a) => (
              <li key={a.key}>
                <div className={`live-card dc-${tone(a.score)} in`}>
                  <Ring v={a.score} size={64} stroke={7} text={String(a.score)} />
                  <span className="dc-name"><AreaIcon k={a.key} size={16} />{MODULE_NAMES[a.key]}</span>
                  <span className="dc-n">Details locked</span>
                </div>
              </li>
            ))}
          </ul>

          <section className="panel inv-lock" aria-label="Issues found">
            <h2>{total} issue{total === 1 ? "" : "s"} found</h2>
            <ul className="inv-sev">
              <li className="bad"><b>{teaser.issues.high}</b><span>High priority</span></li>
              <li className="warn"><b>{teaser.issues.medium}</b><span>Medium</span></li>
              <li><b>{teaser.issues.low}</b><span>Low</span></li>
            </ul>
            <p className="panel-note">The list of issues, the affected pages and the fix for each one open after you sign in.</p>
          </section>
        </main>
      </div>

      <LeadModal
        open={modal}
        url=""
        host={host}
        tool={host}
        unlock
        onClose={() => setModal(false)}
        onSubmit={async () => {
          setModal(false); // signed in: the effect above runs again and opens the report
          return null;
        }}
      />
    </div>
  );
}
