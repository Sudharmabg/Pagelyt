"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLatestReport } from "@/lib/use-latest-report";
import { FREELANCE_SERVICES } from "./content";
import { ModalX, onBackdrop } from "./modal-close";
import { useTurnstile } from "./use-turnstile";

/* The "Work with me" modal itself, loaded only when it is about to open (see `hire-nudge.tsx`). It morphs out of
   whatever opened it (the corner pill, or the account menu button) and shrinks back there on close. Signed-in
   people send with their account; guests (`who` null) type a name and email and pass the human check. */

export type HireWho = { uid: string; name: string; email: string; token: string };
type Service = (typeof FREELANCE_SERVICES)[number];

export const PORTFOLIO = "https://sudharmabg.vercel.app/";
const MAX_NOTE = 1500;
const REPORT_ALL = "Everything in my latest report";
const TIMELINES = ["As soon as possible", "Within a month", "Flexible"] as const;

const SERVICES: Record<Service, { line: string; picks: string[]; field: string; note: string; icon: React.ReactNode }> = {
  "Build a new website": {
    line: "Fast, SEO-ready sites and web apps, designed and launched end to end.",
    picks: ["Landing page", "Business website", "Web app / SaaS", "Online store", "Redesign"],
    field: "Current website, if any",
    note: "What is it for, and who will use it? Any sites you like the look of?",
    icon: <path d="M4 5h16v11H4zM9 20h6M12 16v4M8 9h5M8 12h8" />,
  },
  "Fix my website": {
    line: "Speed, SEO, accessibility and security fixes, done for you.",
    picks: ["Speed & Core Web Vitals", "SEO & AI search", "Accessibility", "Security headers", "Bugs or broken pages"],
    field: "Website to fix",
    note: "Which pages matter most? Anything already tried?",
    icon: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />,
  },
  "Collaborate on a project": {
    line: "Join your team or codebase, for a feature, a sprint or ongoing help.",
    picks: ["Frontend (React / Next.js)", "Backend (Spring Boot / Node)", "AI & LLM features", "Code review", "Ongoing help"],
    field: "Repo or project link",
    note: "What's the stack, and where do you need a hand?",
    icon: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5m0-5c3 0 8 1 8 5" />,
  },
};

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Phones get a bottom sheet (matches the CSS breakpoint). */
const sheet = () => window.matchMedia("(max-width: 560px)").matches;
const tone = (s: number) => (s >= 80 ? "good" : s >= 50 ? "ok" : "bad");

/* The source box mapped onto the dialog's box: a transform plus an elliptical radius that undoes the scale, so the
   first frame of the morph is exactly the pill (or button) it grew out of. */
function frameFrom(src: DOMRect, box: DOMRect) {
  const sx = src.width / box.width;
  const sy = src.height / box.height;
  const dx = src.left + src.width / 2 - (box.left + box.width / 2);
  const dy = src.top + src.height / 2 - (box.top + box.height / 2);
  const r = src.height / 2;
  return { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: `${r / sx}px / ${r / sy}px` };
}

export default function HireModal({ who, from, onSent, onClosed }: { who: HireWho | null; from: DOMRect | null; onSent: () => void; onClosed: (sent: boolean) => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const report = useLatestReport();
  const [settled, setSettled] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [service, setService] = useState<Service | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [timeline, setTimeline] = useState("");
  const [site, setSite] = useState("");
  const [siteTouched, setSiteTouched] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const human = useTurnstile(!who && !sent);
  const name = who?.name ?? guestName.trim();
  const email = who?.email ?? guestEmail.trim();
  const first = name.split(" ")[0] || name;
  const hasReport = !!report && report.score !== null;
  // Until they type their own, the website box follows their latest report (not for "Collaborate": that asks for a repo).
  const siteValue = siteTouched ? site : service === "Collaborate on a project" ? "" : (report?.host ?? "");

  useLayoutEffect(() => {
    const d = dlg.current;
    if (!d || d.open) return;
    d.showModal();
    if (!from || calm()) {
      d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" }).onfinish = () => setSettled(true);
      return;
    }
    const box = d.getBoundingClientRect();
    const radius = getComputedStyle(d).borderRadius; // a bottom sheet on phones: rounded top corners only
    if (!from && sheet()) {
      d.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }).onfinish = () => setSettled(true);
      return;
    }
    if (!from) {
      d.animate([{ opacity: 0, transform: "translateY(12px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }).onfinish = () => setSettled(true);
      return;
    }
    d.animate(
      [
        // starts as the lilac pill and settles into the page's cream
        { ...frameFrom(from, box), backgroundColor: "#ba8aff" },
        { backgroundColor: "#f8e5d4", offset: 0.55 },
        { transform: "none", borderRadius: radius, backgroundColor: "#f8e5d4" },
      ],
      { duration: 620, easing: "linear(0, 0.18 7%, 0.6 20%, 0.9 32%, 1.03 44%, 1.04 52%, 1.01 66%, 1)" },
    ).onfinish = () => setSettled(true);
  }, [from]);

  const close = useCallback((dragged = 0) => {
    const d = dlg.current;
    if (!d || busy || leaving) return;
    setLeaving(true);
    const done = () => {
      d.close();
      onClosed(sent);
    };
    if (calm()) {
      d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).onfinish = done;
      return;
    }
    // Phones: the sheet slides back down (from wherever a swipe left it).
    if (sheet()) {
      d.style.transform = "";
      d.animate([{ transform: `translateY(${dragged}px)` }, { transform: "translateY(100%)" }], { duration: 260, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }).onfinish = done;
      return;
    }
    const box = d.getBoundingClientRect();
    const w = Math.min(220, window.innerWidth - 32);
    const to = from ?? new DOMRect(window.innerWidth - w - 20, window.innerHeight - 76, w, 56);
    d.animate([{ transform: "none", borderRadius: "22px / 22px", opacity: 1 }, { ...frameFrom(to, box), opacity: 0 }], {
      duration: 380,
      easing: "cubic-bezier(0.55, 0, 0.75, 0.2)",
    }).onfinish = done;
  }, [busy, leaving, from, onClosed, sent]);

  const choose = (s: Service) => {
    if (s === service) return;
    setService(s);
    // "Fix my website" with a report starts with the report's issues ticked: the most likely ask.
    setPicks(s === "Fix my website" && hasReport ? [REPORT_ALL] : []);
    setErr("");
  };
  const toggle = (p: string) => setPicks((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]));

  // Grow the note with its text (CSS field-sizing where supported, this elsewhere).
  const grow = (el: HTMLTextAreaElement) => {
    if (CSS.supports("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!service) return setErr("Pick what you need help with.");
    if (!who && (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return setErr("Add your name and a valid email so I can reply.");
    setBusy(true);
    setErr("");
    const reportLink = report && picks.includes(REPORT_ALL) ? `${location.origin}/dashboard/${report.id}` : "";
    const message = [
      picks.length ? `Needs: ${picks.join(", ")}` : "",
      timeline ? `Timeline: ${timeline}` : "",
      reportLink ? `Report: ${reportLink}${report?.score != null ? ` (${report.score}/100)` : ""}` : "",
      note.trim() ? `\n${note.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const r = await fetch("/api/request", {
      method: "POST",
      headers: { "content-type": "application/json", ...(who ? { authorization: `Bearer ${who.token}` } : {}) },
      body: JSON.stringify({ kind: "freelance", name, email, session: service, website: siteValue.trim(), message, ...(who ? {} : { turnstile: human.token() }) }),
    }).catch(() => null);
    setBusy(false);
    if (!who) human.reset(); // a human-check token works once
    if (!r?.ok) {
      const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
      return setErr(r?.status === 429 ? "That's a few requests in a row. Please try again in a little while." : (j?.error ?? "That didn't go through. Please try again, or email me directly."));
    }
    setSent(true);
    onSent();
  };

  // Escape is handled by the dialog's cancel event; Ctrl/⌘+Enter sends from anywhere in the form.
  useEffect(() => {
    const f = form.current;
    if (!f) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        f.requestSubmit();
      }
    };
    f.addEventListener("keydown", onKey);
    return () => f.removeEventListener("keydown", onKey);
  }, [sent]);

  // Swipe the sheet's handle down to dismiss it (phones). Past 90px, or a quick flick, closes; otherwise it springs back.
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const onGrabDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sheet() || busy || leaving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
  };
  const onGrabMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    const d = dlg.current;
    if (!g || !d) return;
    // Upward pulls resist (a quarter of the distance); downward follows the finger.
    g.dy = e.clientY - g.y;
    d.style.transform = `translateY(${g.dy > 0 ? g.dy : g.dy / 4}px)`;
  };
  const onGrabUp = () => {
    const g = drag.current;
    const d = dlg.current;
    drag.current = null;
    if (!g || !d) return;
    const speed = g.dy / Math.max(1, performance.now() - g.t);
    if (g.dy > 90 || (g.dy > 20 && speed > 0.5)) return close(g.dy);
    const from = d.style.transform;
    d.style.transform = "";
    d.animate([{ transform: from || "none" }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  };

  const info = service ? SERVICES[service] : null;
  const st = (i: number) => ({ "--i": i }) as React.CSSProperties;

  return (
    <dialog
      ref={dlg}
      className={`hn-modal${settled ? " is-in" : ""}${leaving ? " hn-leaving" : ""}`}
      aria-labelledby="hn-h"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => onBackdrop(e, close)}
    >
      <div className="hn-grab" aria-hidden="true" onPointerDown={onGrabDown} onPointerMove={onGrabMove} onPointerUp={onGrabUp} onPointerCancel={onGrabUp} />
      <ModalX onClick={() => close()} disabled={busy} label="Not now" />
      <div className="hn-body">
        {sent ? (
          <div className="hn-done" role="status">
            <svg className="hn-check" viewBox="0 0 52 52" aria-hidden="true">
              <circle cx="26" cy="26" r="23" />
              <path d="M15 27l7 7 15-16" />
            </svg>
            <h2 id="hn-h">Thanks, {first}!</h2>
            <p>
              Got your request to <b>{service?.toLowerCase()}</b>. I&rsquo;ll email you at <b>{email}</b> within 24 hours.
            </p>
            <div className="hn-act">
              <a className="hn-btn ghost" href={PORTFOLIO} target="_blank" rel="noopener">See my work ↗</a>
              <button type="button" className="hn-btn" onClick={() => close()}>Done</button>
            </div>
          </div>
        ) : (
          <form ref={form} onSubmit={submit} noValidate>
            <div className="hn-who hn-st" style={st(0)}>
              <span className="hn-av lg" aria-hidden="true">SB</span>
              <span>
                <b>Sudharma BG</b>
                <span className="hn-role">Full stack &amp; AI engineer · built Pagelyt</span>
              </span>
              <span className="hn-badge">Available</span>
            </div>
            <h2 id="hn-h" className="hn-st" style={st(1)}>
              Need a hand with your <em>website</em>?
            </h2>
            <p className="hn-sub hn-st" style={st(2)}>
              I take on freelance work: new builds, fixes, and joining existing projects. 6 years shipping production web apps.{" "}
              <a href={PORTFOLIO} target="_blank" rel="noopener">See sample work ↗</a>
            </p>

            <div className="hn-svc" role="radiogroup" aria-label="What do you need?">
              {FREELANCE_SERVICES.map((s, i) => {
                const on = service === s;
                const fix = s === "Fix my website";
                const picksHere = fix && hasReport ? [REPORT_ALL, ...SERVICES[s].picks] : SERVICES[s].picks;
                return (
                  <div key={s} className={`hn-card hn-st${on ? " on" : ""}`} style={st(3 + i)}>
                    <label className="hn-pick">
                      <input type="radio" name="service" value={s} checked={on} onChange={() => choose(s)} />
                      <svg viewBox="0 0 24 24" aria-hidden="true">{SERVICES[s].icon}</svg>
                      <span className="hn-pick-t">
                        <b>{s}</b>
                        <span>
                          {fix && hasReport ? (
                            <>
                              Your latest report: <strong>{report.host}</strong>{" "}
                              <em className={`hn-score ${tone(report.score!)}`}>{report.score}/100</em> · I can fix what it found
                            </>
                          ) : (
                            SERVICES[s].line
                          )}
                        </span>
                      </span>
                    </label>
                    <div className="hn-more" aria-hidden={!on}>
                      <div>
                        <p className="hn-more-h">{fix ? "What should I fix?" : s === "Build a new website" ? "What are we building?" : "Where can I help?"} <i>Pick any</i></p>
                        <div className="hn-chips">
                          {picksHere.map((p) => (
                            <button
                              key={p}
                              type="button"
                              className={`hn-chip${picks.includes(p) ? " on" : ""}${p === REPORT_ALL ? " star" : ""}`}
                              aria-pressed={picks.includes(p)}
                              tabIndex={on ? 0 : -1}
                              onClick={() => toggle(p)}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hn-extra hn-st" style={st(6)}>
              {!who && (
                <div className="hn-row two">
                  <label className="hn-field">
                    <span>Your name</span>
                    <input type="text" autoComplete="name" maxLength={100} value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
                  </label>
                  <label className="hn-field">
                    <span>Email</span>
                    <input type="email" autoComplete="email" maxLength={254} value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} required />
                  </label>
                </div>
              )}
              <div className="hn-row">
                <label className="hn-field">
                  <span>{info?.field ?? "Website or project link"} <i>(optional)</i></span>
                  <input
                    type="text"
                    inputMode="url"
                    value={siteValue}
                    maxLength={300}
                    placeholder="example.com"
                    onChange={(e) => {
                      setSiteTouched(true);
                      setSite(e.target.value);
                    }}
                  />
                </label>
                <div className="hn-field" role="group" aria-labelledby="hn-tl">
                  <span id="hn-tl">When? <i>(optional)</i></span>
                  <div className="hn-seg">
                    {TIMELINES.map((t) => (
                      <button key={t} type="button" aria-pressed={timeline === t} className={timeline === t ? "on" : undefined} onClick={() => setTimeline((x) => (x === t ? "" : t))}>
                        {t === "As soon as possible" ? "ASAP" : t === "Within a month" ? "This month" : t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <label className="hn-field">
                <span>
                  Anything I should know? <i>(optional)</i>
                  <small className={`hn-count${note.length > MAX_NOTE - 150 ? " near" : ""}`} aria-live="polite">{note.length > 0 ? `${note.length}/${MAX_NOTE}` : ""}</small>
                </span>
                <textarea
                  name="message"
                  rows={2}
                  maxLength={MAX_NOTE}
                  value={note}
                  placeholder={info?.note ?? "Your site, timeline, budget…"}
                  onChange={(e) => {
                    setNote(e.target.value);
                    grow(e.target);
                  }}
                />
              </label>
            </div>

            {!who && human.siteKey && <div ref={human.box} className="hn-human" />}
            {err && <p className="hn-err" role="alert">{err}</p>}
            <div className="hn-act hn-st" style={st(7)}>
              <span className="hn-fine">{who ? <>I&rsquo;ll reply to {who.email}</> : "I reply within 24 hours"}</span>
              <button type="button" className="hn-btn ghost" onClick={() => close()} disabled={busy}>Not now</button>
              <button type="submit" className={`hn-btn${service ? "" : " idle"}`} disabled={busy} aria-keyshortcuts="Control+Enter Meta+Enter">
                {busy ? <span className="hn-spin" aria-hidden="true" /> : null}
                {busy ? "Sending…" : "Contact me"} {!busy && <span className="hn-arr" aria-hidden="true">→</span>}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
