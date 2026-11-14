"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONSULTS, SESSIONS } from "../content";
import { SESSION_EVENT } from "../request-form";
import { useTurnstile } from "../use-turnstile";
import { useSignedInUser } from "@/lib/use-signed-in";
import { supabaseBrowser } from "@/lib/supabase-browser";

/* The consultation booking picker: choose a session, a day and a free start time (shown in the visitor's own
   timezone), then name and email. Booking confirms straight away; nothing is paid now (an invoice follows by email).
   Free times come from /api/booking; a time taken in the meantime gets a 409 and the times reload. */

type Booked = { starts_at: string; ends_at: string; session: string };

const localTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
const dayKey = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const timeOf = (iso: string, tz: string) => new Date(iso).toLocaleTimeString(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit" });
const tzName = (tz: string) => new Intl.DateTimeFormat(undefined, { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? tz;

export function Booker() {
  const user = useSignedInUser();
  const [idx, setIdx] = useState(0);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [day, setDay] = useState("");
  const [start, setStart] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Booked | null>(null);
  const [tz] = useState(localTz);
  const times = useRef<HTMLDivElement>(null);
  const { box, siteKey, token, reset } = useTurnstile(!done && user === null);
  const c = CONSULTS[idx];

  const load = useCallback(async (minutes: number) => {
    setSlots(null);
    setLoadErr("");
    try {
      const r = await fetch(`/api/booking?minutes=${minutes}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { slots?: string[]; error?: string };
      if (!r.ok || !j.slots) throw new Error(j.error || "Times couldn't be loaded just now.");
      setSlots(j.slots);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Times couldn't be loaded just now.");
      setSlots([]);
    }
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      if (live) await load(CONSULTS[idx].mins);
    })();
    return () => {
      live = false;
    };
  }, [idx, load]);

  useEffect(() => {
    const pick = (e: Event) => {
      const i = (e as CustomEvent<number>).detail;
      if (CONSULTS[i]) setIdx(i);
    };
    window.addEventListener(SESSION_EVENT, pick);
    return () => window.removeEventListener(SESSION_EVENT, pick);
  }, []);

  const days = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots ?? []) {
      const k = dayKey(s, tz);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [slots, tz]);
  const activeDay = days.some(([k]) => k === day) ? day : (days[0]?.[0] ?? "");
  const dayTimes = days.find(([k]) => k === activeDay)?.[1] ?? [];
  const chosen = slots?.includes(start) ? start : "";

  const choose = (i: number) => {
    if (i === idx) return;
    setIdx(i);
    setStart("");
    setDay("");
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) || "").trim();
    if (!chosen) return setErr("Please pick a time first.");
    if (!get("name") || !/^\S+@\S+\.\S+$/.test(get("email"))) return setErr("Please enter your name and a valid email address.");
    if (!user && siteKey && !token()) return setErr("Please complete the human check below.");
    setErr("");
    setSending(true);
    try {
      const auth = user ? (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token : undefined;
      const r = await fetch("/api/booking", {
        method: "POST",
        headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
        body: JSON.stringify({
          session: SESSIONS[idx],
          start: chosen,
          name: get("name"),
          email: get("email"),
          website: get("site"),
          message: get("msg"),
          timezone: tz,
          company: get("company"),
          turnstile: user ? undefined : token(),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as Partial<Booked> & { error?: string; taken?: boolean };
      if (r.status === 409 || j.taken) {
        setStart("");
        await load(c.mins);
        throw new Error(j.error || "That time was just taken. Please pick another.");
      }
      if (!r.ok || !j.starts_at) throw new Error(j.error || "We couldn't book that just now.");
      setDone({ starts_at: j.starts_at, ends_at: j.ends_at ?? j.starts_at, session: j.session ?? SESSIONS[idx] });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "We couldn't book that just now.");
      if (!user) reset();
    } finally {
      setSending(false);
    }
  };

  if (done) {
    const d = new Date(done.starts_at).toLocaleDateString(undefined, { timeZone: tz, weekday: "long", day: "numeric", month: "long" });
    return (
      <div className="rq rq-done bk-done" role="status">
        <h3>You&rsquo;re booked.</h3>
        <p>
          <b>{done.session.split(" · ")[0]}</b>
          <br />
          {d}, {timeOf(done.starts_at, tz)} to {timeOf(done.ends_at, tz)} ({tzName(tz)})
        </p>
        <p>
          A confirmation with a calendar file is on its way to your inbox. Sudharma will send the video call link before
          the session. Nothing to pay now: an invoice follows by email.
        </p>
        <p>To cancel, use the link in the email. To change the time, reply to it.</p>
        <button type="button" className="btn ghost" onClick={() => { setDone(null); setStart(""); void load(c.mins); }}>
          Book another session
        </button>
      </div>
    );
  }

  return (
    <form className="rq bk" onSubmit={onSubmit} noValidate aria-labelledby="bk-h">
      <h3 id="bk-h">Book a session</h3>

      <fieldset className="bk-sess">
        <legend>1. Session</legend>
        {CONSULTS.map((s, i) => (
          <label key={s.t} className={i === idx ? "on" : undefined}>
            <input type="radio" name="session" checked={i === idx} onChange={() => choose(i)} />
            <span className="bk-st">{s.t}</span>
            <span className="bk-meta">{s.mins} min · {s.p}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="bk-when" aria-busy={slots === null}>
        <legend>2. Day and time</legend>
        <p className="bk-tz">Times in your timezone: {tzName(tz)}</p>
        {slots === null ? (
          <div className="bk-loading" aria-live="polite">Loading free times…</div>
        ) : loadErr ? (
          <p className="rq-err" role="alert">
            {loadErr}{" "}
            <button type="button" className="fnd-link" onClick={() => void load(c.mins)}>Try again</button>
          </p>
        ) : days.length === 0 ? (
          <p className="bk-none">
            No free {c.mins}-minute times in the next few weeks. <Link href="/contact">Contact us</Link> and we&rsquo;ll find one.
          </p>
        ) : (
          <>
            <div className="bk-days" role="radiogroup" aria-label="Day">
              {days.map(([k, list]) => {
                const d = new Date(list[0]);
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={k === activeDay}
                    className={k === activeDay ? "on" : undefined}
                    onClick={() => {
                      setDay(k);
                      setStart("");
                      times.current?.focus();
                    }}
                  >
                    <small>{d.toLocaleDateString(undefined, { timeZone: tz, weekday: "short" })}</small>
                    <b>{d.toLocaleDateString(undefined, { timeZone: tz, day: "numeric" })}</b>
                    <small>{d.toLocaleDateString(undefined, { timeZone: tz, month: "short" })}</small>
                  </button>
                );
              })}
            </div>
            <div className="bk-times" role="radiogroup" aria-label="Start time" tabIndex={-1} ref={times}>
              {dayTimes.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={s === chosen} className={s === chosen ? "on" : undefined} onClick={() => setStart(s)}>
                  {timeOf(s, tz)}
                </button>
              ))}
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="bk-you">
        <legend>3. Your details</legend>
        {user && (
          <p className="bk-note">
            Signed in as <b>{user.email}</b>. Professional and Business subscribers&rsquo; free annual session is applied
            on the invoice.
          </p>
        )}
        <label>
          Your name
          <input name="name" autoComplete="name" maxLength={100} required defaultValue={user?.name ?? ""} key={`n${user?.id ?? ""}`} />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" maxLength={254} required defaultValue={user?.email ?? ""} key={`e${user?.id ?? ""}`} />
        </label>
        <label>
          Website <span>(optional)</span>
          <input name="site" inputMode="url" maxLength={300} placeholder="https://yourwebsite.com" />
        </label>
        <label>
          What would you like help with? <span>(optional)</span>
          <textarea name="msg" rows={3} maxLength={3000} />
        </label>
      </fieldset>
      {/* Honeypot: hidden from people, often filled in by bots. */}
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="rq-hp" />
      {!user && siteKey && <div ref={box} className="rq-ts" />}
      {err && (
        <p className="rq-err" role="alert">
          {err}
        </p>
      )}
      <button className="btn" type="submit" disabled={sending || !chosen}>
        {sending ? "Booking…" : chosen ? `Book ${new Date(chosen).toLocaleDateString(undefined, { timeZone: tz, weekday: "short", day: "numeric", month: "short" })}, ${timeOf(chosen, tz)}` : "Pick a time to book"}
      </button>
      <p className="bk-fine">Nothing to pay now. We email an invoice ({c.p}) after you book. Cancel any time from your confirmation email.</p>
    </form>
  );
}
