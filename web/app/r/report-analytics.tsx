import { change } from "@/lib/google/gsc-insights";
import { channelRows, findingsOnPath, ga4Drops, rate, type Ga4Ai, type Ga4Data } from "@/lib/google/ga4-insights";
import type { Finding } from "@/lib/scan/types";

/* The Google Analytics section of the printed report (the owner's PDF only, never shared links): the last 28 days
   against the 28 before, channels, pages that lost visits and the AI's insights when they were made. */

const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
const p0 = (n: number) => `${Math.round(n * 100)}%`;

function Delta({ now, before }: { now: number; before: number }) {
  const c = change(now, before);
  if (c == null || c === 0) return null;
  return <small className={c > 0 ? "up" : "down"}>{c > 0 ? "+" : ""}{c}%</small>;
}

export function ReportAnalytics({ d, ai, findings }: { d: Ga4Data; ai: Ga4Ai | null; findings: Finding[] }) {
  const T = d.totals, P = d.prev;
  const chans = channelRows(d).slice(0, 6);
  const drops = ga4Drops(d, 6);
  return (
    <section className="br-ai br-ga" aria-labelledby="br-ga-h">
      <h2 id="br-ga-h">Visitors, last 28 days</h2>
      <p className="br-note">From Google Analytics{d.name ? ` (${d.name})` : ""}, {d.range.start} to {d.range.end}, compared with the 28 days before.</p>
      <div className="br-ai-row">
        <div className="br-ai-big"><b>{n0(T.sessions)}</b><span>visits <Delta now={T.sessions} before={P.sessions} /></span></div>
        <div className="br-ai-p"><b>{n0(T.users)}</b><span>visitors <Delta now={T.users} before={P.users} /></span></div>
        <div className="br-ai-p"><b>{p0(rate(T.engaged, T.sessions))}</b><span>engaged visits</span></div>
        <div className="br-ai-p"><b>{n0(T.keyEvents)}</b><span>key events <Delta now={T.keyEvents} before={P.keyEvents} /></span></div>
      </div>

      {chans.length > 0 && (
        <table className="br-ga-t">
          <thead><tr><th>Channel</th><th>Visits</th><th>Share</th><th>Change</th><th>Engaged</th></tr></thead>
          <tbody>{chans.map((c) => <tr key={c.channel}><td>{c.channel}</td><td>{n0(c.sessions)}</td><td>{p0(c.share)}</td><td>{c.change == null ? "new" : `${c.change > 0 ? "+" : ""}${c.change}%`}</td><td>{p0(c.rate)}</td></tr>)}</tbody>
        </table>
      )}

      {drops.length > 0 && (
        <>
          <h3>Pages that lost visits</h3>
          <table className="br-ga-t">
            <thead><tr><th>Page</th><th>Before</th><th>Now</th><th>Mostly from</th><th>Issues on the page</th></tr></thead>
            <tbody>
              {drops.map((p) => {
                const on = findingsOnPath(p.path, findings);
                return <tr key={p.path}><td>{p.path}</td><td>{n0(p.prevSessions)}</td><td>{n0(p.sessions)}</td><td>{p.channel ?? "–"}</td><td>{on.length ? on.slice(0, 2).map((f) => f.title).join("; ") + (on.length > 2 ? ` +${on.length - 2}` : "") : "None found"}</td></tr>;
              })}
            </tbody>
          </table>
        </>
      )}

      {ai?.insights.length ? (
        <>
          <h3>What the numbers say</h3>
          <ol className="br-ga-ins">
            {ai.insights.map((i) => (
              <li key={i.title}>
                <b>{i.title}</b>
                <p>{i.detail}</p>
                <p className="br-fix"><strong>Next step:</strong> {i.action}</p>
              </li>
            ))}
          </ol>
          <p className="br-note">Written by AI from the Analytics numbers above and this report. Check before acting.</p>
        </>
      ) : null}
    </section>
  );
}
