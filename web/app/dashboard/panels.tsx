"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Findings } from "../findings";
import { findingKey, PENALTY, WEIGHTS } from "@/lib/scan/score";
import { EFFORT_LABEL, quickWins } from "@/lib/scan/effort";
import { MODULE_NAMES, type Finding, type PageWeight, type Severity, type Vitals, type VitalsRun } from "@/lib/scan/types";
import type { StoredScan } from "@/lib/scan/store";

/* ------------------------------------------------------------------ */
/* Explorer: search + severity filter over every finding               */
/* ------------------------------------------------------------------ */

const SEV: { key: Severity | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "Important" },
  { key: "medium", label: "Worth fixing" },
  { key: "low", label: "Minor" },
];

export function FindingsExplorer({ findings, fixed, onToggleFixed, gains }: { findings: Finding[]; fixed: Set<string>; onToggleFixed?: (k: string) => void; gains?: Map<string, number> }) {
  const [bySize, setBySize] = useState(false);
  const [sev, setSev] = useState<Severity | "all">("all");
  const [q, setQ] = useState("");
  const [hideFixed, setHideFixed] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = bySize ? [...findings].sort((a, b) => (gains?.get(findingKey(b)) ?? 0) - (gains?.get(findingKey(a)) ?? 0)) : findings;
    return list.filter((f) => {
      if (sev !== "all" && f.severity !== sev) return false;
      if (hideFixed && fixed.has(findingKey(f))) return false;
      if (!needle) return true;
      return `${f.title} ${f.why} ${f.fix} ${MODULE_NAMES[f.module]}`.toLowerCase().includes(needle);
    });
  }, [findings, sev, q, hideFixed, fixed, bySize, gains]);

  const count = (k: Severity | "all") => (k === "all" ? findings.length : findings.filter((f) => f.severity === k).length);

  return (
    <div className="explorer">
      <div className="fnd-tools">
        <input className="fnd-search" type="search" placeholder="Search findings, e.g. “sitemap” or “email”" aria-label="Search findings" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="fnd-chips" role="group" aria-label="Filter by priority">
          {SEV.map((s) => (
            <button key={s.key} type="button" aria-pressed={sev === s.key} disabled={count(s.key) === 0} onClick={() => setSev(s.key)}>
              {s.label} <span>{count(s.key)}</span>
            </button>
          ))}
          <button type="button" aria-pressed={hideFixed} onClick={() => setHideFixed((v) => !v)}>
            Hide fixed
          </button>
          <button type="button" aria-pressed={bySize} onClick={() => setBySize((v) => !v)} title="Order by the points each fix adds to your score">
            Biggest gain first
          </button>
        </div>
      </div>
      <p className="fnd-result" aria-live="polite">
        Showing {shown.length} of {findings.length}
      </p>
      {shown.length ? (
        <Findings findings={shown} title="All findings" fixed={fixed} onToggleFixed={onToggleFixed} gains={gains} />
      ) : (
        <p className="fnd-empty">Nothing matches. Try clearing the search or filters.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Export + share                                                      */
/* ------------------------------------------------------------------ */

const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;

function download(name: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportMenu({ scan, findings, fixed }: { scan: StoredScan; findings: Finding[]; fixed: Set<string> }) {
  const [note, setNote] = useState("");
  const flash = (m: string) => {
    setNote(m);
    window.setTimeout(() => setNote(""), 2000);
  };
  const checklist = () =>
    [
      `# Website fixes for ${scan.host}`,
      `Score ${scan.overall}/100 · scanned ${scan.scannedAt.slice(0, 10)}`,
      "",
      ...findings.map((f) => `- [${fixed.has(findingKey(f)) ? "x" : " "}] **${f.title}** (${f.severity}, ${MODULE_NAMES[f.module]})\n  - Why: ${f.why}\n  - Fix: ${f.fix}`),
    ].join("\n");
  const base = `pagelyt-${scan.host}-${scan.scannedAt.slice(0, 10)}`;

  const run = async (kind: "copy" | "csv" | "json") => {
    if (kind === "copy") {
      try {
        await navigator.clipboard.writeText(checklist());
        flash("Checklist copied");
      } catch {
        flash("Copy blocked by the browser");
      }
    } else if (kind === "csv") {
      const rows = [["Priority", "Area", "Issue", "Why it matters", "How to fix", "Evidence", "Fixed"], ...findings.map((f) => [f.severity, MODULE_NAMES[f.module], f.title, f.why, f.fix, f.evidence ?? "", fixed.has(findingKey(f)) ? "yes" : "no"])];
      download(`${base}.csv`, "text/csv", rows.map((r) => r.map(csvCell).join(",")).join("\n"));
    } else {
      download(`${base}.json`, "application/json", JSON.stringify(scan, null, 2));
    }
    (document.activeElement as HTMLElement | null)?.closest("details")?.removeAttribute("open");
  };

  const share = (kind: "mail" | "wa") => {
    const msg = encodeURIComponent(`Website report for ${scan.host}: ${scan.overall}/100`);
    const href = encodeURIComponent(window.location.href);
    if (kind === "mail") window.location.href = `mailto:?subject=${msg}&body=${href}`;
    else window.open(`https://wa.me/?text=${msg}%20${href}`, "_blank", "noopener,noreferrer");
    (document.activeElement as HTMLElement | null)?.closest("details")?.removeAttribute("open");
  };
  return (
    <details className="xmenu">
      <summary className="dash-btn">{note || "Export & share"}</summary>
      <div className="xmenu-pop" role="menu">
        <button type="button" role="menuitem" onClick={() => run("copy")}>Copy fix checklist</button>
        <button type="button" role="menuitem" onClick={() => run("csv")}>Download CSV</button>
        <button type="button" role="menuitem" onClick={() => run("json")}>Download JSON</button>
        <hr />
        <button type="button" role="menuitem" onClick={() => share("mail")}>Share by email</button>
        <button type="button" role="menuitem" onClick={() => share("wa")}>Share on WhatsApp</button>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Compare with your previous scan (this browser only)                 */
/* ------------------------------------------------------------------ */

export type Snap = { id: string; at: string; overall: number; mods: Record<string, number>; keys: string[] };

export function useHistory(scan: StoredScan, server?: Snap[]) {
  const synced = !!server && server.length > 0;
  const storeKey = `pagelyt-history-${scan.host}`;
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener("pagelyt-history", cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener("pagelyt-history", cb);
    };
  }, []);
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(storeKey) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]"
  );
  const list = useMemo<Snap[]>(() => {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, [raw]);

  // Remember this scan once, so a later scan of the same site can be compared with it.
  useEffect(() => {
    if (synced || list.some((s) => s.id === scan.id)) return;
    const snap: Snap = { id: scan.id, at: scan.scannedAt, overall: scan.overall, mods: Object.fromEntries(scan.modules.map((m) => [m.key, m.score])), keys: scan.findings.map(findingKey) };
    try {
      window.localStorage.setItem(storeKey, JSON.stringify([...list, snap].slice(-12)));
      window.dispatchEvent(new Event("pagelyt-history"));
    } catch {
      /* storage blocked: no history */
    }
  }, [list, scan, storeKey, synced]);

  const src = synced ? server! : list;
  const prev = [...src].filter((s) => s.id !== scan.id && s.at < scan.scannedAt).pop() ?? null;
  return { prev, trend: src.map((s) => s.overall), synced, points: src.map((s) => ({ at: s.at, overall: s.overall })) };
}

const delta = (n: number) => (n > 0 ? `+${n}` : String(n));

export function ComparePanel({ scan, prev, trend, synced = false, points = [] }: { scan: StoredScan; prev: Snap | null; trend: number[]; synced?: boolean; points?: { at: string; overall: number }[] }) {
  if (!prev) {
    return (
      <section className="panel" aria-label="Progress">
        <h2>Progress over time</h2>
        <p className="panel-note">{synced ? `This is the first saved scan of ${scan.host}. Scheduled rescans will build its history here.` : `This is your first scan of ${scan.host} in this browser. Scan again after making fixes and we’ll show what improved. History is saved on this device only.`}</p>
      </section>
    );
  }
  const now = new Set(scan.findings.map(findingKey));
  const before = new Set(prev.keys);
  const fixedNow = prev.keys.filter((k) => !now.has(k)).length;
  const added = scan.findings.filter((f) => !before.has(findingKey(f))).length;
  const d = scan.overall - prev.overall;
  return (
    <section className="panel" aria-label="Progress since your last scan">
      <h2>Since your last scan</h2>
      <div className="cmp">
        <div className={`cmp-big ${d > 0 ? "up" : d < 0 ? "down" : ""}`}>
          <b>{d === 0 ? "No change" : delta(d)}</b>
          <span>{prev.overall} → {scan.overall}</span>
        </div>
        <ul className="cmp-list">
          <li><b>{fixedNow}</b> issue{fixedNow === 1 ? "" : "s"} resolved</li>
          <li><b>{added}</b> new issue{added === 1 ? "" : "s"}</li>
          {scan.modules.map((m) => {
            const p = prev.mods[m.key];
            if (p === undefined || p === m.score) return null;
            return <li key={m.key}>{m.name} <b className={m.score > p ? "up" : "down"}>{delta(m.score - p)}</b></li>;
          })}
        </ul>
        {trend.length > 1 && !synced && <Spark values={trend} />}
      </div>
      {synced && points.length > 1 && <TrendChart points={points} />}
      <ul className="ba" aria-label="Score by area, before and now">
        {scan.modules.map((m) => {
          const p = prev.mods[m.key];
          if (p === undefined) return null;
          return (
            <li key={m.key}>
              <span className="ba-n">{m.name}</span>
              <span className="ba-track" aria-hidden="true">
                <i className="ba-was" style={{ width: `${p}%` }} />
                <i className={`ba-now ${m.score >= p ? "up" : "down"}`} style={{ width: `${m.score}%` }} />
              </span>
              <span className="ba-v">{p} → {m.score}</span>
            </li>
          );
        })}
      </ul>
      <p className="panel-note">Compared with {new Date(prev.at).toLocaleDateString("en-GB", { dateStyle: "medium" })}. {synced ? "From your saved scans." : "Saved on this device only."}</p>
    </section>
  );
}

function TrendChart({ points }: { points: { at: string; overall: number }[] }) {
  const w = 560, h = 120, padX = 28, padY = 14;
  const x = (i: number) => padX + (i / (points.length - 1)) * (w - padX * 2);
  const y = (v: number) => h - padY - (v / 100) * (h - padY * 2);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.overall).toFixed(1)}`);
  const date = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`Score over time: ${points.map((p) => `${date(p.at)} ${p.overall}`).join(", ")}`}>
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={padX} x2={w - padX} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity=".12" />
            <text x={4} y={y(g) + 3} fontSize="9" fill="currentColor" fillOpacity=".55">{g}</text>
          </g>
        ))}
        <polygon points={`${x(0)},${y(0)} ${line.join(" ")} ${x(points.length - 1)},${y(0)}`} fill="currentColor" fillOpacity=".08" />
        <polyline points={line.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.overall)} r={i === points.length - 1 ? 4 : 2.5} fill="currentColor"><title>{`${date(p.at)}: ${p.overall}`}</title></circle>
        ))}
      </svg>
      <figcaption className="panel-note">{date(points[0].at)} → {date(points[points.length - 1].at)} · {points.length} scans</figcaption>
    </figure>
  );
}

function Spark({ values }: { values: number[] }) {
  const w = 120, h = 36;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (w - 6) + 3},${h - 4 - (v / 100) * (h - 8)}`);
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Score history: ${values.join(", ")}`}>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="3.5" fill="currentColor" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Core Web Vitals                                                     */
/* ------------------------------------------------------------------ */

type Grade = "good" | "ok" | "poor";
const grade = (v: number | null, good: number, poor: number): Grade | null => (v == null ? null : v <= good ? "good" : v <= poor ? "ok" : "poor");
const sec = (ms: number | null) => (ms == null ? "–" : `${(ms / 1000).toFixed(1)} s`);

function Metric({ label, hint, value, g }: { label: string; hint: string; value: string; g: Grade | null }) {
  return (
    <div className={`vm vm-${g ?? "na"}`} title={hint}>
      <span className="vm-l">{label}</span>
      <b>{value}</b>
      <span className="vm-g">{g === "good" ? "Good" : g === "ok" ? "Needs work" : g === "poor" ? "Poor" : ""}</span>
    </div>
  );
}

function RunMetrics({ r }: { r: VitalsRun }) {
  return (
    <div className="vm-grid">
      <Metric label="Largest paint (LCP)" hint="When the main content appears. Good is under 2.5 s." value={sec(r.lcp)} g={grade(r.lcp, 2500, 4000)} />
      <Metric label="First paint (FCP)" hint="When anything first appears. Good is under 1.8 s." value={sec(r.fcp)} g={grade(r.fcp, 1800, 3000)} />
      <Metric label="Layout shift (CLS)" hint="How much the page jumps while loading. Good is under 0.1." value={r.cls == null ? "–" : r.cls.toFixed(2)} g={grade(r.cls, 0.1, 0.25)} />
      <Metric label="Blocking time (TBT)" hint="How long the page is unresponsive while loading. Good is under 200 ms." value={r.tbt == null ? "–" : `${Math.round(r.tbt)} ms`} g={grade(r.tbt, 200, 600)} />
    </div>
  );
}

export function VitalsPanel({ vitals }: { vitals: Vitals | null | undefined }) {
  const [dev, setDev] = useState<"mobile" | "desktop">("mobile");
  if (!vitals) {
    return (
      <section className="panel" aria-label="Core Web Vitals">
        <h2>Core Web Vitals</h2>
        <p className="panel-note">Lighthouse speed data was not available for this scan. The speed checks above use server-side signals only.</p>
      </section>
    );
  }
  const run = vitals[dev] ?? vitals.mobile ?? vitals.desktop;
  const f = vitals.field;
  return (
    <section className="panel" aria-label="Core Web Vitals">
      <div className="panel-head">
        <h2>Core Web Vitals</h2>
        <div className="seg" role="group" aria-label="Device">
          {(["mobile", "desktop"] as const).map((d) => (
            <button key={d} type="button" aria-pressed={dev === d} disabled={!vitals[d]} onClick={() => setDev(d)}>
              {d === "mobile" ? "Mobile" : "Desktop"}
            </button>
          ))}
        </div>
      </div>
      {run && (
        <>
          <p className="vm-score">Lighthouse performance <b>{run.score ?? "–"}</b>/100 <span>· lab test, simulated device</span></p>
          <RunMetrics r={run} />
        </>
      )}
      <h3 className="panel-sub">Real visitors (Chrome field data)</h3>
      {f ? (
        <div className="vm-grid">
          <Metric label="Largest paint (LCP)" hint="75th percentile of real visits." value={sec(f.lcp)} g={grade(f.lcp, 2500, 4000)} />
          <Metric label="Responsiveness (INP)" hint="How quickly the page reacts to taps and clicks. Good is under 200 ms." value={f.inp == null ? "–" : `${f.inp} ms`} g={grade(f.inp, 200, 500)} />
          <Metric label="Layout shift (CLS)" hint="75th percentile of real visits." value={f.cls == null ? "–" : f.cls.toFixed(2)} g={grade(f.cls, 0.1, 0.25)} />
        </div>
      ) : (
        <p className="panel-note">Google has no field data for this address, usually because it has too little traffic. Lab numbers above are estimates, not what visitors experience.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Technology + domain                                                 */
/* ------------------------------------------------------------------ */

export function TechPanel({ tech }: { tech: StoredScan["tech"] }) {
  if (!tech) return null;
  const groups = new Map<string, string[]>();
  for (const t of tech) groups.set(t.category, [...(groups.get(t.category) ?? []), t.name]);
  return (
    <section className="panel" aria-label="Technology detected">
      <h2>Technology detected</h2>
      {groups.size === 0 ? (
        <p className="panel-note">No well-known platforms were recognised. That is common for custom-built sites.</p>
      ) : (
        <dl className="tech">
          {[...groups].map(([cat, names]) => (
            <div key={cat}>
              <dt>{cat}</dt>
              <dd>{names.map((n) => <span key={n} className="chip">{n}</span>)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="panel-note">Detected from the page’s public HTML and headers. Some tools can’t be seen from outside.</p>
    </section>
  );
}

function mailProvider(mx: string[]): string {
  const s = mx.join(" ").toLowerCase();
  if (/google|googlemail/.test(s)) return "Google Workspace";
  if (/outlook|protection\.outlook|microsoft/.test(s)) return "Microsoft 365";
  if (/zoho/.test(s)) return "Zoho Mail";
  if (/mimecast|messagelabs|proofpoint/.test(s)) return "Secure mail gateway";
  return mx[0] ?? "";
}

export function DomainPanel({ domain, links, at }: { domain: StoredScan["domain"]; links: StoredScan["links"]; at: string }) {
  if (!domain) return null;
  const dm = domain.dmarc?.match(/p=(\w+)/i)?.[1]?.toLowerCase();
  const exp = domain.expires ? Math.floor((new Date(domain.expires).getTime() - new Date(at).getTime()) / 86_400_000) : null;
  const rows: { k: string; v: string; ok: boolean | null }[] = [
    { k: "Domain renews", v: exp == null ? "Unknown" : exp < 0 ? "Expired" : `in ${exp} days (${domain.expires!.slice(0, 10)})`, ok: exp == null ? null : exp > 60 },
    { k: "Nameservers", v: domain.ns.length ? `${domain.ns.length} found` : "None found", ok: domain.ns.length > 1 },
    { k: "Email", v: domain.mx.length ? mailProvider(domain.mx) : "No mail records", ok: domain.mx.length ? true : null },
    { k: "SPF", v: domain.spf ? "Published" : "Missing", ok: domain.mx.length ? !!domain.spf : null },
    { k: "DMARC", v: domain.dmarc ? `Policy: ${dm ?? "set"}` : "Missing", ok: domain.mx.length ? !!domain.dmarc && dm !== "none" : null },
  ];
  if (domain.dkim && domain.mx.length) rows.push({ k: "DKIM", v: domain.dkim.length ? `Found (${domain.dkim.join(", ")})` : "Not found at common selectors", ok: domain.dkim.length ? true : null });
  if (domain.dnssec !== undefined) rows.push({ k: "DNSSEC", v: domain.dnssec == null ? "Unknown" : domain.dnssec ? "Signed" : "Off", ok: domain.dnssec });
  if (domain.caa) rows.push({ k: "CAA", v: domain.caa.length ? [...new Set(domain.caa.filter((c) => c.startsWith("issue ")).map((c) => c.split(" ")[1].replace(/;$/, "")))].join(", ") || "Set" : "None (any CA can issue)", ok: domain.caa.length > 0 });
  if (links) rows.push({ k: "Links checked", v: `${links.checked} sampled, ${links.broken} broken`, ok: links.checked === 0 ? null : links.broken === 0 });
  return (
    <section className="panel" aria-label="Domain and email">
      <h2>Domain &amp; email</h2>
      <ul className="facts">
        {rows.map((r) => (
          <li key={r.k}>
            <span className={`dot ${r.ok == null ? "na" : r.ok ? "ok" : "bad"}`} aria-hidden="true" />
            <span className="fk">{r.k}</span>
            <span className="fv">{r.v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How scores work + limits                                            */
/* ------------------------------------------------------------------ */

export function HowScores() {
  return (
    <details className="panel how">
      <summary>How scores work, and what this scan can’t tell you</summary>
      <div className="how-body">
        <p>
          Each area starts at 100. Every open finding takes points off: <b>{PENALTY.high}</b> for important, <b>{PENALTY.medium}</b> for worth fixing and <b>{PENALTY.low}</b> for minor, down to a minimum of 5. The Website Intelligence Score is a weighted average of the areas: problems that can take a site offline or put visitors at risk count for more ({(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).sort((a, b) => WEIGHTS[b] - WEIGHTS[a]).map((k) => `${MODULE_NAMES[k]} ×${WEIGHTS[k]}`).join(", ")}). Ticking an issue as fixed shows the score you’d have once it’s really fixed, then rescan to confirm.
        </p>
        <ul>
          <li><b>Not a compliance certificate.</b> Automated checks find only a share of accessibility problems. Passing them does not mean WCAG compliance, and colour contrast needs a rendered page, which this scan doesn’t do yet.</li>
          <li><b>Lab data is an estimate.</b> Lighthouse simulates one device on one network. Real-visitor (field) data is shown separately when Google has enough traffic to report it.</li>
          <li><b>Privacy checks are signals, not legal advice.</b> They look for a policy link and consent tooling in the page source, not what your policy says.</li>
          <li><b>Link checks are a sample.</b> We test up to 18 links from the page we scanned, not your whole site.</li>
        </ul>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* Site crawl                                                          */
/* ------------------------------------------------------------------ */

export function CrawlPanel({ crawl }: { crawl: StoredScan["crawl"] }) {
  if (!crawl || crawl.list.length < 2) return null;
  const path = (u: string) => {
    try {
      const x = new URL(u);
      return x.pathname + x.search || "/";
    } catch {
      return u;
    }
  };
  return (
    <section className="panel" aria-label="Site crawl">
      <h2>Pages we crawled</h2>
      <p className="panel-note">
        We checked {crawl.pages} page{crawl.pages === 1 ? "" : "s"}
        {crawl.sitemapUrls ? ` (your sitemap lists ${crawl.sitemapUrls})` : ""}; {crawl.broken === 0 ? "none returned an error." : `${crawl.broken} returned an error.`}
      </p>
      <div className="crawl-wrap">
        <table className="crawl">
          <thead>
            <tr><th>Page</th><th>Status</th><th>Title</th><th>Words</th></tr>
          </thead>
          <tbody>
            {crawl.list.map((p) => (
              <tr key={p.url} className={p.status === 0 || p.status >= 400 ? "bad" : undefined}>
                <td title={p.url}>{path(p.url)}</td>
                <td>{p.status || "–"}</td>
                <td>{p.title || <em>missing</em>}</td>
                <td>{p.words}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Images and page weight                                              */
/* ------------------------------------------------------------------ */

const size = (n: number | null | undefined) => (n == null ? "–" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`);

export function ImagesPanel({ images, weight }: { images: StoredScan["images"]; weight: PageWeight | null | undefined }) {
  if (!images && !weight) return null;
  const file = (u: string) => {
    try {
      return new URL(u).pathname.split("/").pop() || u;
    } catch {
      return u;
    }
  };
  return (
    <section className="panel" aria-label="Images and page weight">
      <h2>Images &amp; page weight</h2>
      <ul className="facts">
        {weight?.total != null && (
          <li><span className={`dot ${weight.total > 3_000_000 ? "bad" : "ok"}`} aria-hidden="true" /><span className="fk">Total page weight</span><span className="fv">{size(weight.total)}{weight.requests ? ` · ${weight.requests} requests` : ""}</span></li>
        )}
        {weight?.images != null && (
          <li><span className="dot na" aria-hidden="true" /><span className="fk">Image bytes</span><span className="fv">{size(weight.images)}{weight.imageSavings ? ` · could save ${size(weight.imageSavings)}` : ""}</span></li>
        )}
        {images && (
          <li><span className="dot na" aria-hidden="true" /><span className="fk">Images found</span><span className="fv">{images.count} ({images.probed.length} checked)</span></li>
        )}
      </ul>
      {images && images.probed.length > 0 && (
        <div className="crawl-wrap">
          <table className="crawl">
            <thead>
              <tr><th>Image</th><th>Format</th><th>Size</th></tr>
            </thead>
            <tbody>
              {[...images.probed].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).map((p) => (
                <tr key={p.url} className={(p.bytes ?? 0) > 300_000 ? "bad" : undefined}>
                  <td title={p.url}>{file(p.url)}</td>
                  <td>{p.type.replace("image/", "") || "–"}</td>
                  <td>{size(p.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Quick wins: most points per unit of effort                          */
/* ------------------------------------------------------------------ */

export function QuickWins({ findings, gains, onOpen }: { findings: Finding[]; gains: Map<string, number>; onOpen: (f: Finding) => void }) {
  const list = quickWins(findings, (f) => gains.get(findingKey(f)) ?? 0);
  if (!list.length) return null;
  const total = list.reduce((a, x) => a + x.gain, 0);
  return (
    <section className="panel qw" aria-label="Quick wins">
      <h2>Quick wins</h2>
      <p className="panel-note">The fixes that add the most points for the least work: about <b>+{total} points</b> for these {list.length}.</p>
      <ol>
        {list.map(({ f, gain, effort }) => (
          <li key={findingKey(f)}>
            <button type="button" className="qw-row" onClick={() => onOpen(f)}>
              <span className="qw-t">{f.title}</span>
              <span className="qw-m">{MODULE_NAMES[f.module]}</span>
              <span className={`eff eff-${effort}`}>{EFFORT_LABEL[effort]}</span>
              <span className="gain">+{gain} pt{gain === 1 ? "" : "s"}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Visual change since the previous scan                               */
/* ------------------------------------------------------------------ */

export function ChangePanel({ scan, shots }: { scan: StoredScan; shots?: { now: string | null; prev: string | null } }) {
  const c = scan.change;
  const now = shots?.now ?? null;
  if (!c && !now) return null;
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" });
  const big = !!c && ((c.visual ?? 0) >= 35 || (c.text ?? 0) >= 60 || !!c.title);
  const level = (n: number | null) => (n == null ? "Not measured" : n < 5 ? "No real change" : n < 20 ? `Small change (${n}%)` : n < 35 ? `Noticeable change (${n}%)` : `Major change (${n}%)`);
  return (
    <section className="panel chg" aria-label="Changes since the last scan">
      <h2>{c ? "Changes since the last scan" : "How your homepage looks"}</h2>
      {c ? (
        <>
          <p className="panel-note">
            Compared with the scan on {day(c.prevAt)}.{" "}
            {big ? <b>If you did not make these changes, check the site now: unexpected changes can mean it has been hacked.</b> : "Nothing unexpected stands out."}
          </p>
          <ul className="facts">
            <li><span className={`dot ${c.visual == null ? "na" : c.visual >= 35 ? "bad" : "ok"}`} aria-hidden="true" /><span className="fk">Look</span><span className="fv">{level(c.visual)}</span></li>
            <li><span className={`dot ${c.text == null ? "na" : c.text >= 60 ? "bad" : "ok"}`} aria-hidden="true" /><span className="fk">Text</span><span className="fv">{level(c.text)}</span></li>
            <li><span className={`dot ${c.title ? "bad" : "ok"}`} aria-hidden="true" /><span className="fk">Title</span><span className="fv">{c.title ? `“${c.title.from}” → “${c.title.to}”` : "Unchanged"}</span></li>
          </ul>
        </>
      ) : (
        <p className="panel-note">Save this site and scan it again later: we will compare the two and flag unexpected changes, such as a defaced homepage.</p>
      )}
      {(now || shots?.prev) && (
        <div className="chg-shots">
          {c && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {shots?.prev ? <img src={shots.prev} alt={`Homepage on ${day(c.prevAt)}`} loading="lazy" /> : <span className="chg-none">No screenshot</span>}
              <figcaption>Before · {day(c.prevAt)}</figcaption>
            </figure>
          )}
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {now ? <img src={now} alt={`Homepage on ${day(scan.scannedAt)}`} loading="lazy" /> : <span className="chg-none">No screenshot</span>}
            <figcaption>{c ? "Now" : "Mobile"} · {day(scan.scannedAt)}</figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
