import { change, type GscData } from "@/lib/google/gsc-insights";
import { gaPath } from "@/lib/google/ga4-insights";
import { campaignRows, cpa, landingHealth, money, organicValue, paidOrganicOverlap, weakLanding, type AdsAi, type AdsData } from "@/lib/google/ads-insights";
import type { Finding } from "@/lib/scan/types";

/* The Google Ads section of the printed report (the owner's PDF only, never shared links): the last 28 days against
   the 28 before, campaigns, ad spend on landing pages with issues, keywords with a below-average landing page, paid
   searches already in the organic top 3 and the organic traffic value (with Search Console), and the AI's insights. */

const n0 = (n: number) => Math.round(n).toLocaleString("en-GB");
const p0 = (n: number) => `${Math.round(n * 100)}%`;

function Delta({ now, before }: { now: number; before: number }) {
  const c = change(now, before);
  if (c == null || c === 0) return null;
  return <small className={c > 0 ? "up" : "down"}>{c > 0 ? "+" : ""}{c}%</small>;
}

export function ReportAds({ d, ai, gsc, findings }: { d: AdsData; ai: AdsAi | null; gsc: GscData | null; findings: Finding[] }) {
  const $ = (n: number, digits = 0) => money(n, d.currency, digits);
  const T = d.totals, P = d.prev;
  const c = cpa(T);
  const camps = campaignRows(d).slice(0, 6);
  const lh = landingHealth(d, findings, 6);
  const weak = weakLanding(d, 6);
  const ov = gsc ? paidOrganicOverlap(d, gsc, 6) : null;
  const val = gsc ? organicValue(d, gsc, 5) : null;
  return (
    <section className="br-ai br-ga" aria-labelledby="br-ads-h">
      <h2 id="br-ads-h">Google Ads, last 28 days</h2>
      <p className="br-note">From Google Ads{d.name ? ` (${d.name})` : ""}, {d.range.start} to {d.range.end}, compared with the 28 days before. Amounts in {d.currency}.</p>
      <div className="br-ai-row">
        <div className="br-ai-big"><b>{$(T.cost)}</b><span>spend <Delta now={T.cost} before={P.cost} /></span></div>
        <div className="br-ai-p"><b>{n0(T.clicks)}</b><span>clicks <Delta now={T.clicks} before={P.clicks} /></span></div>
        <div className="br-ai-p"><b>{n0(T.conversions)}</b><span>conversions <Delta now={T.conversions} before={P.conversions} /></span></div>
        <div className="br-ai-p"><b>{c == null ? "–" : $(c, 2)}</b><span>per conversion</span></div>
      </div>

      {camps.length > 0 && (
        <table className="br-ga-t">
          <thead><tr><th>Campaign</th><th>Spend</th><th>Clicks</th><th>Conversions</th><th>Per conversion</th></tr></thead>
          <tbody>{camps.map((x) => <tr key={x.name}><td>{x.name}</td><td>{$(x.cost)}</td><td>{n0(x.clicks)}</td><td>{n0(x.conversions)}</td><td>{x.cpa == null ? "–" : $(x.cpa, 2)}</td></tr>)}</tbody>
        </table>
      )}

      {lh.rows.length > 0 && (
        <>
          <h3>Ad spend on pages with issues: {$(lh.cost)} ({p0(lh.share)})</h3>
          <table className="br-ga-t">
            <thead><tr><th>Landing page</th><th>Spend</th><th>Clicks</th><th>Issues on the page</th></tr></thead>
            <tbody>{lh.rows.map((l) => <tr key={l.url}><td>{gaPath(l.url)}</td><td>{$(l.cost)}</td><td>{n0(l.clicks)}</td><td>{l.issues.slice(0, 2).map((f) => f.title).join("; ")}{l.issues.length > 2 ? ` +${l.issues.length - 2}` : ""}</td></tr>)}</tbody>
          </table>
        </>
      )}

      {weak.length > 0 && (
        <>
          <h3>Keywords with a below-average landing page</h3>
          <table className="br-ga-t">
            <thead><tr><th>Keyword</th><th>Spend</th><th>Quality Score</th><th>Lands on</th></tr></thead>
            <tbody>{weak.map((k) => <tr key={`${k.campaign}|${k.text}|${k.match}`}><td>{k.text}</td><td>{$(k.cost)}</td><td>{k.qs ?? "–"}/10</td><td>{k.url ? gaPath(k.url) : "–"}</td></tr>)}</tbody>
          </table>
        </>
      )}

      {ov && ov.rows.length > 0 && (
        <>
          <h3>Paid searches already in the organic top 3: {$(ov.cost)}</h3>
          <table className="br-ga-t">
            <thead><tr><th>Search</th><th>Ad spend</th><th>Organic position</th><th>Organic clicks</th></tr></thead>
            <tbody>{ov.rows.map((r) => <tr key={r.term}><td>{r.term}</td><td>{$(r.cost)}</td><td>{r.position.toFixed(1)}</td><td>{n0(r.organicClicks)}</td></tr>)}</tbody>
          </table>
        </>
      )}

      {val && gsc && (val.rows.length > 0 || val.rough != null) && (
        <p className="br-note">
          <strong>Organic traffic value:</strong>{" "}
          {val.rows.length > 0 && <>organic clicks on searches you also advertise on would have cost {$(val.matched)} as ads. </>}
          {val.rough != null && <>All {n0(gsc.totals.clicks)} organic clicks at your average cost per click come to roughly {$(val.rough)}.</>}
        </p>
      )}

      {ai?.insights.length ? (
        <>
          <h3>What the ad numbers say</h3>
          <ol className="br-ga-ins">
            {ai.insights.map((i) => (
              <li key={i.title}>
                <b>{i.title}</b>
                <p>{i.detail}</p>
                <p className="br-fix"><strong>Next step:</strong> {i.action}</p>
              </li>
            ))}
          </ol>
          <p className="br-note">Written by AI from the Google Ads numbers above and this report. Check before changing campaigns.</p>
        </>
      ) : null}
    </section>
  );
}
