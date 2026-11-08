"use client";

import { useEffect, useState } from "react";
import type { Analytics } from "@/lib/scan/analytics";

/* Admin analytics tab: headline numbers, daily activity, the sign-up funnel and breakdowns.
   One series per chart, so no legends; every value is also in a table or a label. */

export type Caller = <T>(path: string) => Promise<{ ok: boolean; status: number; json: T & { error?: string } }>;

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

/** Daily column chart with a hover/focus readout. */
function DailyBars({ title, rows, get }: { title: string; rows: Analytics["daily"]; get: (r: Analytics["daily"][number]) => number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 150, top = 14, bottom = 22;
  const max = Math.max(1, ...rows.map(get));
  const slot = W / rows.length;
  const bw = Math.max(2, slot - 2); // 2px gap between columns
  const y = (v: number) => H - bottom - (v / max) * (H - top - bottom);
  const total = rows.reduce((a, r) => a + get(r), 0);
  const h = hover != null ? rows.at(hover) : undefined;
  const label = (i: number) => i === 0 || i === rows.length - 1 || (rows.length > 10 && i === Math.floor(rows.length / 2));

  return (
    <figure className="adm-chart">
      <figcaption>
        <span>{title}</span>
        <b>{h ? <>{get(h)} <small>on {fmtDay(h.day)}</small></> : <>{total} <small>total</small></>}</b>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} per day, ${total} in total, peak ${max}`} onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} className="adm-axis" />
        <text x="0" y={top - 4} className="adm-tick">{max}</text>
        {rows.map((r, i) => {
          const x = i * slot + (slot - bw) / 2;
          const v = get(r);
          const yy = y(v);
          const hgt = H - bottom - yy;
          const rad = Math.min(4, bw / 2, hgt);
          return (
            <g key={r.day}>
              {v > 0 && (
                <path
                  className={`adm-bar${hover === i ? " on" : ""}`}
                  d={`M${x},${H - bottom} V${yy + rad} Q${x},${yy} ${x + rad},${yy} H${x + bw - rad} Q${x + bw},${yy} ${x + bw},${yy + rad} V${H - bottom} Z`}
                />
              )}
              {label(i) && <text x={x + bw / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"} className="adm-tick">{fmtDay(r.day)}</text>}
              {/* Full-height hit target, larger than the mark */}
              <rect x={i * slot} y={0} width={slot} height={H - bottom} fill="transparent" onMouseEnter={() => setHover(i)} tabIndex={-1} />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Horizontal bars with the value and an optional share, for funnels and breakdowns. */
function BarList({ rows, of }: { rows: { label: string; n: number }[]; of?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="panel-note">No data yet.</p>;
  return (
    <ul className="adm-bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="adm-bars-l">{r.label}</span>
          <span className="adm-bars-track">{r.n > 0 && <span className="adm-bars-fill" style={{ width: `${(r.n / max) * 100}%` }} />}</span>
          <span className="adm-bars-n">{r.n}{of != null && <small>{pct(r.n, of)}</small>}</span>
        </li>
      ))}
    </ul>
  );
}

export function AdminAnalytics({ call }: { call: Caller }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    call<Analytics>(`/api/admin/analytics?days=${days}`).then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.json);
        setErr("");
      } else setErr(r.json.error || "Could not load analytics.");
    });
    return () => {
      live = false;
    };
  }, [call, days]);

  const range = (
    <div className="adm-view" role="group" aria-label="Time range">
      {[7, 30, 90].map((d) => (
        <button key={d} type="button" className={`dash-btn${days === d ? " primary" : ""}`} aria-pressed={days === d} onClick={() => setDays(d)}>
          {d} days
        </button>
      ))}
    </div>
  );

  if (err) return <>{range}<p className="acct-msg" role="alert">{err}</p></>;
  if (!data) return <>{range}<p className="dash-loading" role="status">Loading analytics…</p></>;

  const { window: w, totals: t } = data;
  const tiles: [string, string | number, string?][] = [
    ["Scans", w.scans, `${w.hosts} sites · ${pct(w.failed, w.scans)} failed`],
    ["Leads", w.leads, `${pct(w.leads, w.anonymous)} of anonymous scans`],
    ["Sign-ups", data.usersAvailable ? w.signups : "–", data.usersAvailable ? `${t.users} accounts in total` : "Auth API unavailable"],
    ["Active users", data.usersAvailable ? w.active : "–", "Signed in during the period"],
    ["Paid accounts", t.paid, `${pct(t.paid, t.users || t.paid)} of accounts`],
    ["Saved sites", t.sites, `${w.sitesSaved} new · ${t.scheduled} scheduled`],
  ];

  return (
    <div className="adm-an">
      <div className="ag-tools">{range}<p className="panel-note">Since {fmtDay(data.daily[0].day)} (UTC)</p></div>

      <ul className="adm-tiles" aria-label="Headline numbers">
        {tiles.map(([label, n, sub]) => (
          <li key={label}><span>{label}</span><b>{n}</b>{sub && <small>{sub}</small>}</li>
        ))}
      </ul>

      <section className="panel" aria-label="Daily activity">
        <h2>Daily activity</h2>
        <DailyBars title="Scans" rows={data.daily} get={(r) => r.scans} />
        <DailyBars title="Leads" rows={data.daily} get={(r) => r.leads} />
        {data.usersAvailable && <DailyBars title="Sign-ups" rows={data.daily} get={(r) => r.signups} />}
        <details className="adm-table">
          <summary>Show as a table</summary>
          <div className="crawl-wrap">
            <table className="crawl">
              <thead><tr><th>Day</th><th>Scans</th><th>Leads</th>{data.usersAvailable && <th>Sign-ups</th>}</tr></thead>
              <tbody>
                {[...data.daily].reverse().map((d) => (
                  <tr key={d.day}><td>{fmtDay(d.day)}</td><td>{d.scans}</td><td>{d.leads}</td>{data.usersAvailable && <td>{d.signups}</td>}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="adm-cols">
        <section className="panel" aria-label="Funnel">
          <h2>Funnel</h2>
          <p className="panel-note">People at each step in this period, as a share of scans run.</p>
          <BarList rows={data.funnel} of={data.funnel[0]?.n ?? 0} />
        </section>
        <section className="panel" aria-label="Most scanned sites">
          <h2>Most scanned sites</h2>
          <BarList rows={data.topHosts} />
        </section>
        <section className="panel" aria-label="Plans">
          <h2>Plans</h2>
          <BarList rows={data.plans} />
        </section>
        <section className="panel" aria-label="Account types">
          <h2>Account types</h2>
          <BarList rows={data.accountTypes} />
        </section>
      </div>

      <section className="panel" aria-label="Feature use">
        <h2>Feature use</h2>
        <BarList rows={[
          { label: "Shared reports created", n: w.shares },
          { label: "Competitor comparisons", n: w.comparisons },
          { label: "AI visibility answers", n: w.aiRuns },
          { label: "Sites with AI tracking", n: t.aiTracked },
          { label: "Sites with uptime on", n: t.uptime },
        ]} />
      </section>
    </div>
  );
}
