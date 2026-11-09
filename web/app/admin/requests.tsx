"use client";

import { useCallback, useEffect, useState } from "react";
import type { RequestRow, RequestStatus } from "@/lib/requests";

/* Admin requests tab: consultation requests and contact messages from the website forms, newest first. */

type Caller = <T>(path: string, body?: unknown) => Promise<{ ok: boolean; status: number; json: T & { error?: string } }>;

const STATUSES: RequestStatus[] = ["new", "contacted", "scheduled", "closed"];
const LABEL: Record<RequestStatus, string> = { new: "New", contacted: "Contacted", scheduled: "Scheduled", closed: "Closed" };
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function AdminRequests({ call }: { call: Caller }) {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState<"open" | "all">("open");

  const fetchRows = useCallback(() => call<{ requests?: RequestRow[] }>("/api/admin/requests"), [call]);
  const apply = useCallback((r: Awaited<ReturnType<typeof fetchRows>>) => {
    if (!r.ok || !r.json.requests) return setMsg(r.json.error ?? "Could not load requests.");
    setRows(r.json.requests);
    setMsg("");
  }, []);
  const load = useCallback(async () => apply(await fetchRows()), [apply, fetchRows]);

  useEffect(() => {
    let live = true;
    void fetchRows().then((r) => live && apply(r));
    return () => {
      live = false;
    };
  }, [apply, fetchRows]);

  const update = async (id: string, status: RequestStatus) => {
    setRows((rs) => rs?.map((x) => (x.id === id ? { ...x, status } : x)) ?? rs);
    const r = await call("/api/admin/requests", { id, status });
    if (!r.ok) {
      setMsg(r.json.error ?? "Could not update.");
      void load();
    }
  };

  if (!rows) return <p className="panel-note">{msg || "Loading requests…"}</p>;
  const list = show === "open" ? rows.filter((r) => r.status !== "closed") : rows;
  const fresh = rows.filter((r) => r.status === "new").length;

  return (
    <>
      <ul className="ag-stats" aria-label="Summary">
        <li className={fresh ? "bad" : undefined}><b>{fresh}</b><span>New requests</span></li>
        <li><b>{rows.filter((r) => r.kind === "consultation").length}</b><span>Consultations</span></li>
        <li><b>{rows.filter((r) => r.kind === "contact").length}</b><span>Messages</span></li>
      </ul>
      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>
      <div className="ag-tools">
        <div className="adm-view" role="group" aria-label="Show">
          {(["open", "all"] as const).map((v) => (
            <button key={v} type="button" className={`dash-btn${show === v ? " primary" : ""}`} aria-pressed={show === v} onClick={() => setShow(v)}>
              {v === "open" ? "Open" : "All"}
            </button>
          ))}
        </div>
        <button type="button" className="dash-btn" onClick={() => void load()}>Refresh</button>
      </div>
      <section className="panel" aria-label="Requests">
        {list.length === 0 ? (
          <p className="panel-note">{show === "open" ? "No open requests." : "No requests yet."}</p>
        ) : (
          <div className="crawl-wrap">
            <table className="crawl ag-table adm-req">
              <thead>
                <tr><th>Received</th><th>From</th><th>Request</th><th>Message</th><th>Status</th></tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={r.status === "new" ? "is-new" : undefined}>
                    <td>{fmt(r.created_at)}<span className="ag-sub">{r.kind === "consultation" ? "Consultation" : "Contact"}</span></td>
                    <td>
                      <strong>{r.name}</strong>
                      <span className="ag-sub"><a className="fnd-link" href={`mailto:${r.email}`}>{r.email}</a></span>
                      {r.website && <span className="ag-sub">{r.website}</span>}
                    </td>
                    <td>
                      {r.session ?? "–"}
                      {r.preferred_time && <span className="ag-sub">Prefers: {r.preferred_time}</span>}
                    </td>
                    <td className="adm-msg">{r.message || "–"}</td>
                    <td>
                      <label className="sr-only" htmlFor={`st-${r.id}`}>Status for {r.name}</label>
                      <select id={`st-${r.id}`} value={r.status} onChange={(e) => void update(r.id, e.target.value as RequestStatus)}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
