"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type B = { starts_at: string; ends_at: string; session: string; status: "confirmed" | "cancelled" | "done"; name: string };

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString(undefined, o);

export function ManageBooking({ id, t }: { id: string; t: string }) {
  const [b, setB] = useState<B | null>(null);
  const [err, setErr] = useState(id && t ? "" : "This link isn't complete. Use the link from your confirmation email.");
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!id || !t) return;
    let live = true;
    fetch(`/api/booking/manage?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as B & { error?: string };
        if (!live) return;
        if (!r.ok) setErr(j.error || "This link isn't valid.");
        else setB(j);
      })
      .catch(() => live && setErr("Your booking couldn't be loaded. Please try again."));
    return () => {
      live = false;
    };
  }, [id, t]);

  const cancel = async () => {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/booking/manage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, t }) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (!r?.ok) return setErr(j?.error || "It couldn't be cancelled just now. Please reply to your confirmation email.");
    setB((x) => (x ? { ...x, status: "cancelled" } : x));
    setSure(false);
  };

  if (!b)
    return (
      <div className="rq">
        <h1 className="bk-mh">Your booking</h1>
        {err ? <p className="rq-err" role="alert">{err}</p> : <p aria-live="polite">Loading your booking…</p>}
        <Link className="btn ghost" href="/consultation">Go to consultations</Link>
      </div>
    );

  const title = b.session.split(" · ")[0];
  const when = `${fmt(b.starts_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${fmt(b.starts_at, { hour: "numeric", minute: "2-digit" })} to ${fmt(b.ends_at, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`;
  const past = Date.parse(b.starts_at) < now;

  return (
    <div className="rq">
      <h1 className="bk-mh">{b.status === "cancelled" ? "Booking cancelled" : `Hi ${b.name}, here's your booking`}</h1>
      <p>
        <b>{title}</b>
        <br />
        {when}
      </p>
      {b.status === "cancelled" ? (
        <>
          <p role="status">This session is cancelled. A cancellation email with a calendar update is on its way.</p>
          <Link className="btn" href="/consultation#book">Book another time</Link>
        </>
      ) : b.status === "done" || past ? (
        <p>This session has already taken place. Reply to your confirmation email with any follow-up questions.</p>
      ) : (
        <>
          <p>Need a different time? Reply to your confirmation email and we&rsquo;ll move it. Or cancel below.</p>
          {err && <p className="rq-err" role="alert">{err}</p>}
          {sure ? (
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => void cancel()} disabled={busy}>{busy ? "Cancelling…" : "Yes, cancel it"}</button>
              <button type="button" className="btn ghost" onClick={() => setSure(false)} disabled={busy}>Keep my booking</button>
            </div>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setSure(true)}>Cancel this booking</button>
          )}
        </>
      )}
    </div>
  );
}
