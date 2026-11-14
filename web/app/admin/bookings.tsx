"use client";

import { useCallback, useEffect, useState } from "react";
import type { Block, Booking, BookingSettings, Window } from "@/lib/booking";

/* Admin bookings tab: upcoming and recent consultation bookings (add the call link, move, cancel, mark done),
   the weekly hours visitors can book, blocked days, and notice / horizon / buffer. Times show in IST. */

type Caller = <T>(path: string, body?: unknown) => Promise<{ ok: boolean; status: number; json: T & { error?: string } }>;
type Row = Omit<Booking, "manage_token">;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const IST = "Asia/Kolkata";
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const API = "/api/admin/booking";

export function AdminBookings({ call }: { call: Caller }) {
  const [data, setData] = useState<{ settings: BookingSettings; blocks: Block[]; bookings: Row[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState<"upcoming" | "all">("upcoming");

  const load = useCallback(async () => {
    const r = await call<{ settings: BookingSettings; blocks: Block[]; bookings: Row[] }>(API);
    if (!r.ok) return setMsg(r.json.error ?? "Could not load bookings.");
    setData(r.json);
  }, [call]);
  useEffect(() => {
    let live = true;
    void call<{ settings: BookingSettings; blocks: Block[]; bookings: Row[] }>(API).then((r) => {
      if (!live) return;
      if (r.ok) setData(r.json);
      else setMsg(r.json.error ?? "Could not load bookings.");
    });
    return () => {
      live = false;
    };
  }, [call]);

  const act = async (body: Record<string, unknown>, done: string) => {
    setMsg("Saving…");
    const r = await call<{ emailed?: boolean }>(API, body);
    if (!r.ok) return setMsg(r.json.error ?? "Could not update.");
    setMsg(r.json.emailed === false ? `${done.replace(/ and emailed\.$/, ".")} The email wasn't sent (emails are off or it failed).` : done);
    await load();
  };

  if (!data) return <p className="panel-note">{msg || "Loading bookings…"}</p>;
  const now = new Date().toISOString();
  const upcoming = data.bookings.filter((b) => b.status === "confirmed" && b.ends_at >= now);
  const list = show === "upcoming" ? upcoming : [...data.bookings].reverse();

  return (
    <>
      <ul className="ag-stats" aria-label="Summary">
        <li className={upcoming.some((b) => !b.meet_url) ? "bad" : undefined}><b>{upcoming.filter((b) => !b.meet_url).length}</b><span>Need a call link</span></li>
        <li><b>{upcoming.length}</b><span>Upcoming</span></li>
        <li><b>{data.bookings.filter((b) => b.status === "done").length}</b><span>Done (30 days)</span></li>
      </ul>
      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>
      <div className="ag-tools">
        <div className="adm-view" role="group" aria-label="Show">
          {(["upcoming", "all"] as const).map((v) => (
            <button key={v} type="button" className={`dash-btn${show === v ? " primary" : ""}`} aria-pressed={show === v} onClick={() => setShow(v)}>
              {v === "upcoming" ? "Upcoming" : "All, last 30 days"}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? <p className="panel-note">No bookings here yet.</p> : (
        <ul className="bk-list">
          {list.map((b) => <BookingCard key={b.id} b={b} call={call} act={act} />)}
        </ul>
      )}
      <Hours settings={data.settings} act={act} />
      <Blocks blocks={data.blocks} act={act} />
    </>
  );
}

function BookingCard({ b, call, act }: { b: Row; call: Caller; act: (body: Record<string, unknown>, done: string) => Promise<void> }) {
  const [meet, setMeet] = useState(b.meet_url ?? "");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [pick, setPick] = useState("");
  const live = b.status === "confirmed";
  const loadSlots = async () => {
    const r = await call<{ slots: string[] }>(API, { action: "slots", id: b.id });
    setSlots(r.ok ? r.json.slots : []);
  };
  return (
    <li className={`bk-card bk-${b.status}`}>
      <div className="bk-top">
        <b>{when(b.starts_at)} IST</b>
        <span className="bk-st">{b.status}</span>
      </div>
      <p className="bk-who"><b>{b.name}</b> · <a href={`mailto:${b.email}`}>{b.email}</a>{b.website ? <> · {b.website}</> : null}</p>
      <p className="bk-sess">{b.session}{b.timezone && b.timezone !== IST ? ` · visitor in ${b.timezone}` : ""}{b.user_id ? " · signed-in user" : ""}</p>
      {b.message && <p className="bk-msg">{b.message}</p>}
      {live && (
        <>
          <form className="bk-row" onSubmit={(e) => { e.preventDefault(); void act({ action: "meet", id: b.id, meetUrl: meet }, meet ? "Call link saved and emailed." : "Call link removed."); }}>
            <label className="sr-only" htmlFor={`meet-${b.id}`}>Call link</label>
            <input id={`meet-${b.id}`} value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="https://meet.google.com/…" inputMode="url" />
            <button type="submit" className="dash-btn">{b.meet_url ? "Update link" : "Save and email link"}</button>
          </form>
          <div className="bk-row">
            {slots == null ? (
              <button type="button" className="dash-btn" onClick={() => void loadSlots()}>Move…</button>
            ) : (
              <form className="bk-row" onSubmit={(e) => { e.preventDefault(); if (pick) void act({ action: "move", id: b.id, start: pick }, "Moved and emailed."); }}>
                <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="New time">
                  <option value="">{slots.length ? "Choose a new time (IST)…" : "No free times"}</option>
                  {slots.map((s) => <option key={s} value={s}>{when(s)}</option>)}
                </select>
                <button type="submit" className="dash-btn" disabled={!pick}>Move</button>
              </form>
            )}
            <button type="button" className="dash-btn" onClick={() => void act({ action: "done", id: b.id }, "Marked done.")}>Mark done</button>
            <button type="button" className="dash-btn danger" onClick={() => { if (window.confirm(`Cancel ${b.name}'s session on ${when(b.starts_at)}? They get an email.`)) void act({ action: "cancel", id: b.id }, "Cancelled and emailed."); }}>Cancel</button>
          </div>
        </>
      )}
    </li>
  );
}

function Hours({ settings, act }: { settings: BookingSettings; act: (body: Record<string, unknown>, done: string) => Promise<void> }) {
  const [s, setS] = useState(settings);
  const setDay = (d: number, ws: Window[]) => setS((x) => ({ ...x, hours: { ...x.hours, [String(d)]: ws } }));
  return (
    <section className="panel bk-hours" aria-labelledby="bk-hours-h">
      <h2 id="bk-hours-h">Bookable hours</h2>
      <p className="panel-note">Times in {s.timezone}. Visitors see them in their own timezone. Slots start every 30 minutes.</p>
      <table className="crawl">
        <tbody>
          {DAYS.map((name, d) => {
            const ws = s.hours[String(d)] ?? [];
            return (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>
                  {ws.length === 0 && <em>Closed</em>}
                  {ws.map((w, i) => (
                    <span key={i} className="bk-win">
                      <input type="time" value={w[0]} onChange={(e) => setDay(d, ws.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} aria-label={`${name} from`} />
                      to
                      <input type="time" value={w[1]} onChange={(e) => setDay(d, ws.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} aria-label={`${name} until`} />
                      <button type="button" className="fnd-link" onClick={() => setDay(d, ws.filter((_, j) => j !== i))}>Remove</button>
                    </span>
                  ))}
                  {ws.length < 4 && <button type="button" className="fnd-link" onClick={() => setDay(d, [...ws, ["09:00", "17:00"]])}>Add hours</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="bk-nums">
        <label>Minimum notice (hours)<input type="number" min={0} max={336} value={s.notice_hours} onChange={(e) => setS({ ...s, notice_hours: Number(e.target.value) })} /></label>
        <label>Book up to (days ahead)<input type="number" min={1} max={120} value={s.horizon_days} onChange={(e) => setS({ ...s, horizon_days: Number(e.target.value) })} /></label>
        <label>Buffer between calls (minutes)<input type="number" min={0} max={120} value={s.buffer_min} onChange={(e) => setS({ ...s, buffer_min: Number(e.target.value) })} /></label>
        <label>Timezone<input value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} /></label>
      </div>
      <button type="button" className="dash-btn primary" onClick={() => void act({ action: "settings", settings: s }, "Hours saved.")}>Save hours</button>
    </section>
  );
}

function Blocks({ blocks, act }: { blocks: Block[]; act: (body: Record<string, unknown>, done: string) => Promise<void> }) {
  const [day, setDay] = useState("");
  const [note, setNote] = useState("");
  return (
    <section className="panel" aria-labelledby="bk-blocks-h">
      <h2 id="bk-blocks-h">Days off</h2>
      <p className="panel-note">No one can book on these days. Existing bookings stay: move or cancel them above.</p>
      <form className="bk-row" onSubmit={(e) => { e.preventDefault(); if (day) void act({ action: "block", day, note }, "Day blocked.").then(() => { setDay(""); setNote(""); }); }}>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" required />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={200} aria-label="Note" />
        <button type="submit" className="dash-btn">Block this day</button>
      </form>
      {blocks.length > 0 && (
        <ul className="bk-blocks">
          {blocks.map((b) => (
            <li key={b.day}>
              <b>{new Date(`${b.day}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" })}</b>
              {b.note ? ` · ${b.note}` : ""}
              <button type="button" className="fnd-link" onClick={() => void act({ action: "unblock", day: b.day }, "Day opened again.")}>Open again</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
