"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STAGE_LABELS } from "@/lib/scan/labels";
import { overallScore } from "@/lib/scan/score";
import { MODULE_NAMES, type ModuleKey } from "@/lib/scan/types";
import { forgetVerifyEmail, useVerifyEmail } from "@/lib/pending";
import { stepScan } from "@/lib/run-scan";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { AuthLink } from "../auth-link";
import { CodeForm } from "../code-form";
import { Ring, tone } from "../ui";
import { AreaIcon } from "./icons";

type Area = { key: ModuleKey; score: number };

/* The one-time email code, as a modal over the live scan. It can't be closed: the findings stay locked until the
   code is in, and the scan keeps running behind it. */
function CodeModal({ email, onVerified }: { email: string; onVerified: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="lead-modal" aria-labelledby="lock-h" onCancel={(e) => e.preventDefault()}>
      <div className="lm-body lm-code">
        <h2 id="lock-h">Verify your email</h2>
        <p className="lm-sub">
          We&rsquo;ve sent a 6-digit code to {email ? <strong>{email}</strong> : "the email you signed up with"}. Enter it to see the findings; your scan keeps running
          meanwhile. You only need to do this once.
        </p>
        <CodeForm email={email} onVerified={onVerified} />
      </div>
    </dialog>
  );
}
const KEYS = Object.keys(MODULE_NAMES) as ModuleKey[];

/* The dashboard while a scan runs, in the dashboard's own layout: every area starts as "Checking…" and gets its
   tick and score the moment no later stage can change it, and the overall score builds up from the finished areas.
   The scan is driven from this page (one request per stage), so it also keeps going while a new account enters its
   email code. The server never sends the findings until the owner is verified; only the area scores show here.
   `claim`: a signed-in visitor's new scan, saved to their account once it finishes (as the homepage used to do). */
export function PendingDashboard({ id, host, status, locked, error, stage: stage0, areas: areas0, claim }: { id: string; host: string; status: "running" | "done" | "failed"; locked: boolean; error: string | null; stage: number; areas: Area[]; claim?: boolean }) {
  const router = useRouter();
  const email = useVerifyEmail();
  const [stage, setStage] = useState(stage0);
  const [areas, setAreas] = useState<Area[]>(areas0);
  const [state, setState] = useState(status);
  const [problem, setProblem] = useState(error);

  // Drive the remaining scan stages, then show the full report (unless the email code is still missing).
  useEffect(() => {
    if (status !== "running") return;
    let live = true;
    void stepScan(id, (_label, p) => {
      if (!live) return;
      setStage(p.stage);
      setAreas(p.areas);
    }).then(async (r) => {
      if (!live) return;
      if ("error" in r) {
        setState("failed");
        setProblem(r.error);
        return;
      }
      setState("done");
      if (claim) {
        const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
        if (token) await fetch("/api/account/claim", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ scanId: id }) }).catch(() => {});
      }
      if (!live || locked) return;
      window.setTimeout(() => {
        if (claim) window.history.replaceState(null, "", window.location.pathname); // drop ?new=1
        router.refresh();
      }, 900); // a moment to see the last ticks land
    });
    return () => {
      live = false;
    };
  }, [id, status, locked, router, claim]);

  const verified = () => {
    forgetVerifyEmail();
    router.refresh(); // the server now sends the report (or this page again, without the lock, while it finishes)
  };

  const scoreOf = new Map(areas.map((a) => [a.key, a.score]));
  const finished = KEYS.filter((k) => scoreOf.has(k));
  const overall = finished.length ? overallScore(finished.map((k) => ({ key: k, score: scoreOf.get(k)! }))) : null;
  const total = STAGE_LABELS.length;
  const pct = state === "done" ? 100 : Math.min(98, Math.round((stage / total) * 100));

  return (
    <div className="dash live">
      <header className="dash-top">
        <Link href="/" className="dash-logo" aria-label="Pagelyt home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Pagelyt" width={140} height={30} />
        </Link>
        <div className="dash-site">
          <strong>{host}</strong>
          <span>{state === "running" ? "Scan in progress" : state === "failed" ? "Scan stopped" : "Scan complete"}</span>
        </div>
        <div className="dash-act">
          <Link href="/" className="dash-btn">Scan another site</Link>
        </div>
        <AuthLink compact />
      </header>

      <div className="dash-body">
        <nav className="dash-nav" aria-label="Areas being checked">
          <p className="nav-h">Areas</p>
          {KEYS.map((k) => (
            <button key={k} type="button" disabled className={scoreOf.has(k) ? "live-done" : "live-wait"}>
              <span className="nv"><AreaIcon k={k} />{MODULE_NAMES[k]}</span>
              {scoreOf.has(k) ? <b className={`t-${tone(scoreOf.get(k)!)}`}>{scoreOf.get(k)}</b> : <i className="live-spin" aria-label="Checking" />}
            </button>
          ))}
        </nav>

        <main className="dash-main">
          {locked && <CodeModal email={email} onVerified={verified} />}

          <section className="dash-hero" aria-label="Scan progress">
            {overall === null ? <div className="live-ring" aria-hidden="true" /> : <Ring v={overall} size={132} stroke={13} text={String(overall)} />}
            <div className="dash-hero-txt">
              <p className="dash-eyebrow">{state === "done" ? "Website Intelligence Score" : `Scanning ${host}`}</p>
              <h1>{state === "failed" ? "The scan stopped" : state === "done" ? (locked ? "Your report is ready" : "Opening your report…") : `${finished.length} of ${KEYS.length} areas done`}</h1>
              {state === "failed" ? (
                <p className="lm-err" role="alert">{problem || "The scan failed."} <Link href="/">Try again</Link></p>
              ) : (
                <p aria-live="polite">
                  {overall === null ? "Scores appear as each area finishes. This takes 10 to 30 seconds." : `Score so far, from the ${finished.length} finished area${finished.length === 1 ? "" : "s"}.`}
                </p>
              )}
              <div className="dash-progress">
                <div className="dp-bar" role="progressbar" aria-label="Scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${Math.max(4, pct)}%` }} /></div>
              </div>
              <ol className="live-steps">
                {STAGE_LABELS.map((t, i) => {
                  const done = state === "done" || i < stage;
                  return (
                    <li key={t} className={done ? "done" : i === stage && state === "running" ? "now" : ""}>
                      <span className="lm-mark" aria-hidden="true">{done ? "✓" : ""}</span>
                      {t}
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <ul className="dash-cards" aria-label="Scores by area">
            {KEYS.map((k) => {
              const s = scoreOf.get(k);
              return (
                <li key={k}>
                  <div className={`live-card${s === undefined ? " wait" : ` dc-${tone(s)} in`}`}>
                    {s === undefined ? <div className="live-ring sm" aria-hidden="true" /> : <Ring v={s} size={64} stroke={7} text={String(s)} />}
                    <span className="dc-name"><AreaIcon k={k} size={16} />{MODULE_NAMES[k]}</span>
                    <span className="dc-n">{s === undefined ? "Checking…" : "✓ Done"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </main>
      </div>
    </div>
  );
}
