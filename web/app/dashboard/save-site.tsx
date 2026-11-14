"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { SignInLink } from "@/app/sign-in-modal";

type Cadence = "daily" | "weekly" | "monthly" | "none";
const CADENCES: { id: Cadence; label: string; text: string; tag?: string }[] = [
  { id: "daily", label: "Daily", text: "For busy shops and sites that change often" },
  { id: "weekly", label: "Weekly", text: "Spot a problem within a week of it starting", tag: "Recommended" },
  { id: "monthly", label: "Monthly", text: "A light check-in for sites that rarely change" },
  { id: "none", label: "Never", text: "Just keep this report in your account" },
];
const DAYS: Record<Cadence, number> = { daily: 1, weekly: 7, monthly: 30, none: 0 };

/* The dashboard's "Save & monitor" section: keep this report in the account and choose a rescan schedule, uptime
   checks and email alerts. Picks up the saved settings when the site is already saved. Hidden entirely when
   Supabase is not configured. */
export function SaveSite({ scanId, host }: { scanId: string; host: string }) {
  const sb = supabaseBrowser();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [uptime, setUptime] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const [existing, setExisting] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");
  const [now] = useState(() => Date.now()); // fixed at mount, for the "next rescan" date

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  // Already saved? Start from its settings, so this section edits them rather than resetting them.
  useEffect(() => {
    if (!sb || !signedIn) return;
    let live = true;
    sb.from("sites").select("cadence,uptime,alerts").eq("host", host).limit(1)
      .then(({ data }) => {
        const s = (data as { cadence: Cadence; uptime: boolean; alerts: boolean | null }[] | null)?.[0];
        if (!live || !s) return;
        setExisting(true);
        setCadence(s.cadence);
        setUptime(s.uptime);
        setAlerts(s.alerts !== false);
      });
    return () => { live = false; };
  }, [sb, signedIn, host]);

  if (!sb || signedIn === undefined) return null;
  if (!signedIn)
    return (
      <div className="panel mon-out">
        <p><b>Sign in to keep watching {host}.</b> Saved sites get scheduled rescans, uptime checks and an email when something gets worse.</p>
        <SignInLink className="dash-btn primary" stay>Sign in to save</SignInLink>
      </div>
    );

  const save = async () => {
    setState("saving");
    setErr("");
    try {
      const token = (await sb.auth.getSession()).data.session?.access_token;
      const r = await fetch("/api/account/claim", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ scanId, cadence, uptime, alerts }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not save.");
      setExisting(true);
      setState("saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
      setState("idle");
    }
  };
  const edit = () => state === "saved" && setState("idle");

  const next = cadence === "none" ? null : new Date(now + DAYS[cadence] * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  const steps = [
    { on: true, t: "This report is kept in your account", s: "Open it any time from your dashboard." },
    { on: !!next, t: next ? `Next rescan around ${next}` : "No scheduled rescans", s: next ? `Then ${CADENCES.find((c) => c.id === cadence)!.label.toLowerCase()}, with the score tracked over time.` : "Pick a schedule to track the score over time." },
    { on: uptime, t: uptime ? "Uptime checks are on" : "Uptime checks are off", s: uptime ? "We email you if the site stops answering." : "Turn on to hear when the site goes down." },
    { on: alerts && !!next, t: alerts && next ? "Email alerts are on" : "No email alerts", s: alerts && next ? "When the score drops, a new important issue appears or the homepage changes." : next ? "Turn on to hear when something gets worse." : "Alerts come from scheduled rescans." },
  ];

  return (
    <div className="mon">
      <div className="panel mon-main">
        <fieldset className="mon-set">
          <legend>How often should we rescan {host}?</legend>
          <div className="mon-cad" role="radiogroup">
            {CADENCES.map((c) => (
              <label key={c.id} className={`mon-opt${cadence === c.id ? " on" : ""}`}>
                <input type="radio" name="cadence" value={c.id} checked={cadence === c.id} onChange={() => { setCadence(c.id); edit(); }} />
                <span className="mon-opt-top"><b>{c.label}</b>{c.tag && <em>{c.tag}</em>}</span>
                <small>{c.text}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mon-set">
          <legend>Keep an eye on it</legend>
          <label className="mon-tog">
            <span><b>Uptime monitoring</b><small>We check that the site answers and email you if it goes down.</small></span>
            <input type="checkbox" role="switch" checked={uptime} onChange={(e) => { setUptime(e.target.checked); edit(); }} />
          </label>
          <label className={`mon-tog${cadence === "none" ? " off" : ""}`}>
            <span><b>Email alerts</b><small>{cadence === "none" ? "Needs a rescan schedule: alerts come from scheduled rescans." : "When the score drops, a new important issue appears or the homepage changes."}</small></span>
            <input type="checkbox" role="switch" checked={alerts && cadence !== "none"} disabled={cadence === "none"} onChange={(e) => { setAlerts(e.target.checked); edit(); }} />
          </label>
        </fieldset>

        {err && <p className="lm-err" role="alert">{err}</p>}
        <div className="mon-act">
          <button type="button" className={`dash-btn primary${state === "saved" ? " ok" : ""}`} onClick={save} disabled={state !== "idle"}>
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : existing ? "Update monitoring" : "Save & start monitoring"}
          </button>
          {state === "saved" && <span role="status" className="mon-ok">Done. <Link className="fnd-link" href="/account">Manage your sites</Link></span>}
        </div>
      </div>

      <aside className="panel mon-side" aria-label="What happens next">
        <p className="mon-side-h">{existing ? <><span className="mon-dot" aria-hidden="true" />Monitoring {host}</> : "What happens next"}</p>
        <ol className="mon-steps">
          {steps.map((s) => (
            <li key={s.t} className={s.on ? "on" : ""}>
              <span className="mon-mark" aria-hidden="true">{s.on ? "✓" : ""}</span>
              <span><b>{s.t}</b><small>{s.s}</small></span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
