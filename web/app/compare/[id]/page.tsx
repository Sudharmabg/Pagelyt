import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { tone } from "../../ui";
import { getComparison } from "@/lib/scan/agency";
import { overallScore } from "@/lib/scan/score";
import { getScanRow } from "@/lib/scan/store";
import { MODULE_NAMES, type Finding, type ModuleKey, type ScanResult } from "@/lib/scan/types";

export const metadata: Metadata = {
  title: "Competitor comparison",
  robots: { index: false, follow: false }, // private-by-link, like reports
};

type Col = { id: string; host: string; res: ScanResult; overall: number; you: boolean };

const kb = (n: number | null) => (n == null ? "–" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`);
const secs = (ms: number | null) => (ms == null ? "–" : `${(ms / 1000).toFixed(1)} s`);
const num = (n: number | null) => (n == null ? "–" : String(n));
const SEV = { high: 0, medium: 1, low: 2 } as const;

/** Indexes of the best value in a row (higher or lower is better); ties all win, a lone value never does. */
function best(values: (number | null)[], higher: boolean): Set<number> {
  const nums = values.flatMap((v, i) => (v == null ? [] : [[v, i] as const]));
  if (nums.length < 2) return new Set();
  const top = higher ? Math.max(...nums.map(([v]) => v)) : Math.min(...nums.map(([v]) => v));
  return new Set(nums.filter(([v]) => v === top).map(([, i]) => i));
}

const key = (f: Finding) => `${f.module}:${f.id}`;

export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const cmp = await getComparison((await params).id);
  if (!cmp) notFound();
  const rows = await Promise.all([cmp.scan_id, ...cmp.rival_ids].map((id) => getScanRow(id)));
  const cols = rows.flatMap((r, i): Col[] => (r?.status === "done" && r.result ? [{ id: r.id, host: r.result.host, res: r.result, overall: overallScore(r.result.modules), you: i === 0 }] : []));
  if (cols.length < 2 || !cols[0].you) notFound();
  const [me, ...rivals] = cols;

  const modules = Object.keys(MODULE_NAMES) as ModuleKey[];
  const rowsData: { label: string; values: (number | null)[]; fmt: (n: number | null) => string; higher: boolean; main?: boolean }[] = [
    { label: "Overall score", values: cols.map((c) => c.overall), fmt: num, higher: true, main: true },
    ...modules.map((k) => ({ label: MODULE_NAMES[k], values: cols.map((c) => c.res.modules.find((m) => m.key === k)?.score ?? null), fmt: num, higher: true })),
    { label: "Mobile speed (Lighthouse)", values: cols.map((c) => c.res.vitals?.mobile?.score ?? null), fmt: num, higher: true },
    { label: "Main content appears (LCP)", values: cols.map((c) => c.res.vitals?.mobile?.lcp ?? null), fmt: secs, higher: false },
    { label: "Page weight", values: cols.map((c) => c.res.vitals?.weight?.total ?? null), fmt: kb, higher: false },
    { label: "Important issues", values: cols.map((c) => c.res.findings.filter((f) => f.severity === "high").length), fmt: num, higher: false },
    { label: "All issues", values: cols.map((c) => c.res.findings.length), fmt: num, higher: false },
  ];

  // Where you lag: issues you have that no competitor has. Where you lead: issues most competitors have that you don't.
  const mine = new Set(me.res.findings.map(key));
  const rivalSets = rivals.map((c) => new Set(c.res.findings.map(key)));
  const seen = new Set<string>();
  const behind = me.res.findings
    .filter((f) => !seen.has(key(f)) && seen.add(key(f)) && rivalSets.every((s) => !s.has(key(f))))
    .sort((a, b) => SEV[a.severity] - SEV[b.severity]);
  const lead = new Map<string, { f: Finding; n: number }>();
  rivals.forEach((c, i) => {
    for (const k of rivalSets[i]) {
      if (mine.has(k)) continue;
      const cur = lead.get(k);
      if (cur) cur.n++;
      else lead.set(k, { f: c.res.findings.find((f) => key(f) === k)!, n: 1 });
    }
  });
  const ahead = [...lead.values()].filter((x) => x.n >= Math.ceil(rivals.length / 2)).sort((a, b) => b.n - a.n || SEV[a.f.severity] - SEV[b.f.severity]);

  const when = new Date(cmp.created_at).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" });
  const rank = [...cols].sort((a, b) => b.overall - a.overall).findIndex((c) => c.you) + 1;

  return (
    <>
      <SiteNav />
      <main>
        <section className="sec acct" aria-label="Competitor comparison">
          <div className="container acct-grid cmp">
            <header className="acct-head">
              <div>
                <p className="dash-eyebrow">Competitor comparison · {when}</p>
                <h1>{me.host} vs {rivals.map((r) => r.host).join(", ")}</h1>
                <p className="panel-note">
                  {me.host} ranks <b>{rank} of {cols.length}</b> on the Website Intelligence Score.
                </p>
              </div>
              <div className="brand-act">
                <Link className="dash-btn" href={`/dashboard/${me.id}`}>Back to your report</Link>
              </div>
            </header>

            <section className="panel" aria-label="Scores side by side">
              <h2>Side by side</h2>
              <div className="crawl-wrap">
                <table className="crawl cmp-table">
                  <thead>
                    <tr>
                      <th><span className="sr-only">Measure</span></th>
                      {cols.map((c) => (
                        <th key={c.id}>
                          <Link href={`/dashboard/${c.id}`}>{c.host}</Link>
                          {c.you && <span className="cmp-you">You</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsData.map((r) => {
                      const w = best(r.values, r.higher);
                      return (
                        <tr key={r.label} className={r.main ? "cmp-main" : undefined}>
                          <th scope="row">{r.label}</th>
                          {r.values.map((v, i) => (
                            <td key={cols[i].id} className={w.has(i) ? "cmp-win" : undefined}>
                              {r.main && v != null ? <b className={`t-${tone(v)}`}>{v}</b> : r.fmt(v)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="panel-note">Green marks the best result in each row. Speed figures need Lighthouse data, which is not available for every scan.</p>
            </section>

            <div className="panel-grid">
              <section className="panel" aria-label="Where you are behind">
                <h2>Where you&rsquo;re behind</h2>
                <p className="panel-note">Problems on {me.host} that none of these competitors have.</p>
                {behind.length ? (
                  <ul className="cmp-list">
                    {behind.slice(0, 12).map((f) => (
                      <li key={key(f)} className={`sev-${f.severity}`}><b>{f.title}</b><span>{MODULE_NAMES[f.module]}</span></li>
                    ))}
                  </ul>
                ) : (
                  <p className="panel-note">Nothing: every issue you have, at least one competitor has too.</p>
                )}
              </section>
              <section className="panel" aria-label="Where you lead">
                <h2>Where you lead</h2>
                <p className="panel-note">Problems most of these competitors have that {me.host} doesn&rsquo;t.</p>
                {ahead.length ? (
                  <ul className="cmp-list">
                    {ahead.slice(0, 12).map(({ f, n }) => (
                      <li key={key(f)} className={`sev-${f.severity}`}><b>{f.title}</b><span>{MODULE_NAMES[f.module]} · {n} of {rivals.length} competitors</span></li>
                    ))}
                  </ul>
                ) : (
                  <p className="panel-note">No clear advantages yet. Fixing the items on the left is the fastest way to pull ahead.</p>
                )}
              </section>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
