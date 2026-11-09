"use client";

import { Arrow } from "./arrow";

import { useEffect, useState } from "react";
import { SESSIONS } from "./content";
import { CONTACT_EMAIL } from "./site-config";
import { useTurnstile } from "./use-turnstile";

type Kind = "consultation" | "contact";

/** Fired by the session cards on the consultation page to pick a session in this form. */
export const SESSION_EVENT = "pagelyt:session";

/* Consultation and contact form. Sends to /api/request, which stores it in Supabase for the admin panel. */
export function RequestForm({ kind }: { kind: Kind }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");
  const [session, setSession] = useState(SESSIONS[0]);
  const { box, siteKey, token, reset } = useTurnstile(state !== "sent");

  useEffect(() => {
    const pick = (e: Event) => {
      const i = (e as CustomEvent<number>).detail;
      if (SESSIONS[i]) setSession(SESSIONS[i]);
    };
    window.addEventListener(SESSION_EVENT, pick);
    return () => window.removeEventListener(SESSION_EVENT, pick);
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) || "").trim();
    if (!get("name") || !/^\S+@\S+\.\S+$/.test(get("email"))) return setErr("Please enter your name and a valid email address.");
    if (kind === "contact" && !get("msg")) return setErr("Please write a short message.");
    if (siteKey && !token()) return setErr("Please complete the human check below.");
    setErr("");
    setState("sending");
    try {
      const r = await fetch("/api/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          name: get("name"),
          email: get("email"),
          website: get("site"),
          session: kind === "consultation" ? session : undefined,
          preferredTime: get("when"),
          message: get("msg"),
          company: get("company"),
          turnstile: token(),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "We couldn't send that just now.");
      setState("sent");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "We couldn't send that just now.");
      setState("idle");
      reset();
    }
  };

  if (state === "sent")
    return (
      <div className="rq rq-done" role="status">
        <h3>{kind === "consultation" ? "Request received." : "Message sent."}</h3>
        <p>
          {kind === "consultation"
            ? "Thanks. We'll email you within one business day to confirm a time for your session."
            : "Thanks for getting in touch. We'll reply within one business day."}
        </p>
        <button className="btn ghost" onClick={() => setState("idle")}>
          Send another
        </button>
      </div>
    );

  return (
    <form className="rq" onSubmit={onSubmit} noValidate>
      <h3>{kind === "consultation" ? "Request a consultation" : "Send us a message"}</h3>
      <label>
        Your name
        <input name="name" autoComplete="name" maxLength={100} required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" maxLength={254} required />
      </label>
      <label>
        Website <span>(optional)</span>
        <input name="site" inputMode="url" maxLength={300} placeholder="https://yourwebsite.com" />
      </label>
      {kind === "consultation" && (
        <>
          <label>
            Session
            <select name="slot" value={session} onChange={(e) => setSession(e.target.value)}>
              {SESSIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Preferred day and time <span>(optional)</span>
            <input name="when" maxLength={120} placeholder="For example, weekday mornings IST" />
          </label>
        </>
      )}
      <label>
        {kind === "consultation" ? "What would you like help with?" : "How can we help?"}
        <textarea name="msg" rows={4} maxLength={3000} />
      </label>
      {/* Honeypot: hidden from people, often filled in by bots. */}
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="rq-hp" />
      {siteKey && <div ref={box} className="rq-ts" />}
      {err && (
        <p className="rq-err" role="alert">
          {err}{" "}
          {state === "idle" && err.startsWith("We couldn") && (
            <>
              You can also email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </>
          )}
        </p>
      )}
      <button className="btn" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : kind === "consultation" ? "Request my consultation" : "Send message"} <Arrow />
      </button>
    </form>
  );
}
