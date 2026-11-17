"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { SignInLink } from "@/app/sign-in-modal";

type Cadence = "daily" | "weekly" | "monthly" | "none";
type Ico = keyof typeof ICONS;
const CADENCES: { id: Cadence; label: string; text: string; tag?: string; color: string; icon: Ico }[] = [
  { id: "daily", label: "Daily", text: "For busy shops and sites that change often", color: "#e0620d", icon: "bolt" },
  { id: "weekly", label: "Weekly", text: "Spot a problem within a week of it starting", tag: "Recommended", color: "#0e8f7e", icon: "star" },
  { id: "monthly", label: "Monthly", text: "A light check-in for sites that rarely change", color: "#4f46e5", icon: "moon" },
  { id: "none", label: "Never", text: "Just keep this report in your account", color: "#64748b", icon: "pause" },
];
const DAYS: Record<Cadence, number> = { daily: 1, weekly: 7, monthly: 30, none: 0 };
// Which of the next 14 days get a rescan, for the little calendar strip on each card.
const STRIP: Record<Cadence, (d: number) => boolean> = { daily: () => true, weekly: (d) => d % 7 === 0, monthly: (d) => d === 0, none: () => false };

const ICONS = {
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  pause: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 9v6M14 9v6",
  save: "M6 3h12v18l-6-4-6 4z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  pulse: "M3 12h4l2-6 4 12 2-6h6",
  mail: "M4 5h16v14H4zM4 7l8 6 8-6",
  check: "m5 12 5 5 9-10",
};
const Svg = ({ k }: { k: Ico }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[k]} /></svg>
);

/* The dashboard's "Save & monitor" section: keep this report in the account and choose a rescan schedule, uptime
   checks and email alerts. A status strip on top shows what is switched on; the settings sit below. Picks up the
   saved settings when the site is already saved. Hidden entirely when Supabase is not configured. */
export function SaveSite({ scanId, host }: { scanId: string; host: string }) {
  const sb = supabaseBrowser();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [uptime, setUptime] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const [existing, setExisting] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");
  const [now] = useState(() => Date.now()); // fixed at mount, for the "next rescan" dates

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

  const dateIn = (c: Cadence) => (c === "none" ? null : new Date(now + DAYS[c] * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
  const next = dateIn(cadence);
  const label = CADENCES.find((c) => c.id === cadence)!.label;
  const alertsOn = alerts && cadence !== "none";
  const steps: { on: boolean; icon: Ico; t: string; s: string }[] = [
    { on: true, icon: "save", t: "Kept in your account", s: "Open this report any time from your dashboard." },
    { on: !!next, icon: "clock", t: next ? `Rescans ${label.toLowerCase()}` : "No scheduled rescans", s: next ? `Next one around ${next}, with the score tracked over time.` : "Pick a schedule to track the score over time." },
    { on: uptime, icon: "pulse", t: uptime ? "Uptime checks on" : "Uptime checks off", s: uptime ? "We email you if the site stops answering." : "Turn on to hear when the site goes down." },
    { on: alertsOn, icon: "mail", t: alertsOn ? "Email alerts on" : "No email alerts", s: alertsOn ? "When the score drops, a new important issue appears or the homepage changes." : next ? "Turn on to hear when something gets worse." : "Alerts come from scheduled rescans." },
  ];
  const summary = [next ? `${label} rescans` : "No rescans", uptime ? "Uptime on" : "Uptime off", alertsOn ? "Alerts on" : "Alerts off"];

  return (
    <div className="mon">
      <section className={`mon-status${existing ? " live" : ""}`} aria-label={existing ? `Monitoring ${host}` : "What happens next"}>
        <div className="mon-status-head">
          <p className="mon-status-h">
            <span className="mon-dot" aria-hidden="true" />
            {existing ? <>Monitoring <b>{host}</b></> : <>What happens when you save <b>{host}</b></>}
          </p>
          <span className="mon-status-next">{next ? <>Next rescan <b>{next}</b></> : "No rescan scheduled"}</span>
        </div>
        <ol className="mon-steps">
          {steps.map((s, i) => (
            <li key={s.icon} className={s.on ? "on" : ""} style={{ ["--i" as string]: i } as CSSProperties}>
              <span className="mon-step-ico"><Svg k={s.icon} /></span>
              <span className="mon-step-txt"><b>{s.t}</b><small>{s.s}</small></span>
              <span className="mon-mark" aria-label={s.on ? "On" : "Off"}>{s.on && <Svg k="check" />}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="panel mon-main">
        <fieldset className="mon-set">
          <legend>How often should we rescan {host}?</legend>
          <div className="mon-cad" role="radiogroup">
            {CADENCES.map((c, i) => {
              const d = dateIn(c.id);
              return (
                <label key={c.id} className={`mon-opt${cadence === c.id ? " on" : ""}`} style={{ ["--c" as string]: c.color, ["--i" as string]: i } as CSSProperties}>
                  <input type="radio" name="cadence" value={c.id} checked={cadence === c.id} onChange={() => { setCadence(c.id); edit(); }} />
                  <span className="mon-opt-top">
                    <span className="mon-opt-ico"><Svg k={c.icon} /></span>
                    <b>{c.label}</b>
                    {c.tag && <em>{c.tag}</em>}
                    <span className="mon-radio" aria-hidden="true" />
                  </span>
                  <span className="mon-strip" aria-hidden="true">
                    {Array.from({ length: 14 }, (_, k) => <i key={k} className={STRIP[c.id](k) ? "on" : ""} />)}
                  </span>
                  <small>{c.text}</small>
                  <span className="mon-opt-next">{d ? <>Next: <b>{d}</b></> : "No rescans"}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mon-set">
          <legend>Keep an eye on it</legend>
          <div className="mon-togs">
            <label className={`mon-tog${uptime ? " on" : ""}`} style={{ ["--c" as string]: "#d6336c" } as CSSProperties}>
              <span className="mon-tog-ico"><Svg k="pulse" /></span>
              <span className="mon-tog-txt"><b>Uptime monitoring</b><small>We check that the site answers and email you if it goes down.</small></span>
              <input type="checkbox" role="switch" checked={uptime} onChange={(e) => { setUptime(e.target.checked); edit(); }} />
            </label>
            <label className={`mon-tog${alertsOn ? " on" : ""}${cadence === "none" ? " off" : ""}`} style={{ ["--c" as string]: "#7b3fe0" } as CSSProperties}>
              <span className="mon-tog-ico"><Svg k="mail" /></span>
              <span className="mon-tog-txt"><b>Email alerts</b><small>{cadence === "none" ? "Needs a rescan schedule: alerts come from scheduled rescans." : "When the score drops, a new important issue appears or the homepage changes."}</small></span>
              <input type="checkbox" role="switch" checked={alertsOn} disabled={cadence === "none"} onChange={(e) => { setAlerts(e.target.checked); edit(); }} />
            </label>
          </div>
        </fieldset>

        {err && <p className="lm-err" role="alert">{err}</p>}
        <div className="mon-act">
          <ul className="mon-sum" aria-label="Your choices">
            {summary.map((t) => <li key={t}>{t}</li>)}
          </ul>
          {state === "saved" && <span role="status" className="mon-ok">Done. <Link className="fnd-link" href="/account">Manage your sites</Link></span>}
          <button type="button" className={`dash-btn primary mon-save${state === "saved" ? " ok" : ""}`} onClick={save} disabled={state !== "idle"}>
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : existing ? "Update monitoring" : "Save & start monitoring"}
          </button>
        </div>
      </div>
    </div>
  );
}
