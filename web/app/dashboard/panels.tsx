"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Findings } from "../findings";
import { findingKey, PENALTY, WEIGHTS } from "@/lib/scan/score";
import { EFFORT_LABEL, quickWins } from "@/lib/scan/effort";
import { evidenceText, MODULE_NAMES, type Finding, type PageWeight, type Severity, type Vitals, type VitalsRun } from "@/lib/scan/types";
import type { StoredScan } from "@/lib/scan/store";
import { Tile } from "./action-modal";
import { crawlWhy, type CrawlFix } from "@/lib/scan/crawl-why";

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
  const box = useRef<HTMLInputElement>(null);

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
        <div className="fnd-find">
          <svg className="fnd-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={box}
            className="fnd-search"
            type="search"
            placeholder="Search findings, e.g. “sitemap” or “email”"
            aria-label="Search findings"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && q) {
                e.stopPropagation();
                setQ("");
              }
            }}
          />
          {q && (
            <button type="button" className="fnd-clear" aria-label="Clear search" onClick={() => { setQ(""); box.current?.focus(); }}>
              ×
            </button>
          )}
        </div>
        <div className="fnd-chips" role="group" aria-label="Filter findings">
          {SEV.map((s) => (
            <button key={s.key} type="button" aria-pressed={sev === s.key} disabled={count(s.key) === 0} onClick={() => setSev(s.key)}>
              {s.label} <span>{count(s.key)}</span>
            </button>
          ))}
          <i className="fnd-sep" aria-hidden="true" />
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

/* The Export modal's tiles: PDF, the fix checklist and raw data. Sharing has its own modal in the dashboard. */
export function ExportTiles({ scan, findings, fixed, pdfLabel, pdfText, onPdf, pdfBusy }: { scan: StoredScan; findings: Finding[]; fixed: Set<string>; pdfLabel: string; pdfText: string; onPdf: () => void; pdfBusy?: boolean }) {
  const [done, setDone] = useState<"" | "copy" | "csv" | "json" | "copy-fail">("");
  const flash = (k: typeof done) => {
    setDone(k);
    window.setTimeout(() => setDone(""), 2200);
  };
  const open = findings.filter((f) => !fixed.has(findingKey(f))).length;
  // Every issue, most important first, in every export.
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const all = [...findings].sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
  const count = (s: string) => findings.filter((f) => f.severity === s).length;
  const summary = `${findings.length} issue${findings.length === 1 ? "" : "s"}: ${count("high")} important, ${count("medium")} worth fixing, ${count("low")} minor (${open} still open)`;
  const sevName = (s: string) => (s === "high" ? "Important" : s === "medium" ? "Worth fixing" : "Minor");
  const checklist = () =>
    [
      `# Website fixes for ${scan.host}`,
      `${scan.url} · Score ${scan.overall}/100 · scanned ${scan.scannedAt.slice(0, 10)}`,
      summary,
      "",
      ...all.map((f, i) => {
        const ev = evidenceText(f);
        return [
          `- [${fixed.has(findingKey(f)) ? "x" : " "}] ${i + 1}. **${f.title}** (${sevName(f.severity)}, ${MODULE_NAMES[f.module]})`,
          `  - Why: ${f.why}`,
          `  - Fix: ${f.fix}`,
          ...(ev ? [`  - Where: ${ev.split("\n").join("; ")}`] : []),
        ].join("\n");
      }),
      "",
      "Made with Pagelyt · https://pagelyt.dev",
    ].join("\n");
  const base = `pagelyt-${scan.host}-${scan.scannedAt.slice(0, 10)}`;

  const run = async (kind: "copy" | "csv" | "json") => {
    if (kind === "copy") {
      try {
        await navigator.clipboard.writeText(checklist());
        flash("copy");
      } catch {
        flash("copy-fail");
      }
    } else if (kind === "csv") {
      const rows = [["#", "Priority", "Area", "Issue", "Why it matters", "How to fix", "Affected pages", "Evidence", "Fixed"], ...all.map((f, i) => [String(i + 1), sevName(f.severity), MODULE_NAMES[f.module], f.title, f.why, f.fix, String(f.pages?.rows.length ?? ""), evidenceText(f), fixed.has(findingKey(f)) ? "yes" : "no"])];
      download(`${base}.csv`, "text/csv", rows.map((r) => r.map(csvCell).join(",")).join("\n"));
      flash("csv");
    } else {
      const report = { generatedBy: "Pagelyt (https://pagelyt.dev)", site: scan.url, summary: { issues: findings.length, important: count("high"), worthFixing: count("medium"), minor: count("low"), open }, ...scan, findings: all.map((f) => ({ ...f, fixed: fixed.has(findingKey(f)) })) };
      download(`${base}.json`, "application/json", JSON.stringify(report, null, 2));
      flash("json");
    }
  };

  return (
    <>
      <Tile icon="pdf" title={pdfLabel} text={pdfText} onClick={onPdf} busy={pdfBusy} tone="accent" />
      <Tile icon="check" title="Copy fix checklist" text={`All ${findings.length} issues (${open} still open) as a to-do list with where each was found, ready for Notion, Trello or an email.`} onClick={() => void run("copy")} done={done === "copy" ? "Copied to your clipboard" : done === "copy-fail" ? "Your browser blocked copying" : undefined} />
      <Tile icon="table" title="Download CSV" text={`All ${findings.length} issues with priority, fix and every affected page, for Excel or Google Sheets.`} onClick={() => void run("csv")} done={done === "csv" ? "Downloaded" : undefined} />
      <Tile icon="code" title="Download JSON" text={`The full raw report with all ${findings.length} issues and a summary, for developers and your own tools.`} onClick={() => void run("json")} done={done === "json" ? "Downloaded" : undefined} />
    </>
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
const GRADE_TEXT: Record<Grade, string> = { good: "Good", ok: "Needs work", poor: "Poor" };

/** True once the element has scrolled into view (and stays true), for bars and scales that fill in on arrival. */
export function useInView<T extends Element>(): [React.RefCallback<T>, boolean] {
  const [seen, setSeen] = useState(false);
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

type MetricKey = "lcp" | "fcp" | "cls" | "tbt" | "inp";
/* Each metric in everyday words: what it measures, the thresholds Google uses, and the usual fix. */
const METRIC: Record<MetricKey, { name: string; abbr: string; what: string; fix: string; good: number; poor: number; max: number; fmt: (v: number) => string }> = {
  fcp: { name: "First thing appears", abbr: "FCP", what: "When the first text or image shows up. Until then, visitors look at a blank screen and some give up.", fix: "Move or defer the CSS and scripts in the page's head that hold up drawing, and serve the page from a CDN with caching.", good: 1800, poor: 3000, max: 4500, fmt: (v) => sec(v) },
  lcp: { name: "Main content appears", abbr: "LCP", what: "When the biggest thing on screen (usually the hero image or main headline) has loaded. This is the moment visitors feel the page is ready.", fix: "Compress and resize the hero image, preload it, and make the server answer faster.", good: 2500, poor: 4000, max: 6000, fmt: (v) => sec(v) },
  cls: { name: "Layout jumps", abbr: "CLS", what: "How much things move around while the page loads. A button that jumps just as someone taps makes them hit the wrong thing.", fix: "Give every image and embed a width and height, and reserve space for banners, ads and cookie bars.", good: 0.1, poor: 0.25, max: 0.4, fmt: (v) => v.toFixed(2) },
  tbt: { name: "Frozen time", abbr: "TBT", what: "How long the page ignores taps and scrolling while JavaScript runs during loading.", fix: "Remove scripts you don't use, load chat widgets and trackers after the page, and split large JavaScript bundles.", good: 200, poor: 600, max: 1000, fmt: (v) => `${Math.round(v)} ms` },
  inp: { name: "Reaction to taps", abbr: "INP", what: "How long real visitors wait between tapping or clicking and seeing the page respond.", fix: "Break long JavaScript tasks into smaller pieces and do less work when buttons are clicked.", good: 200, poor: 500, max: 800, fmt: (v) => `${Math.round(v)} ms` },
};

/** Good / needs work / poor bands with a marker where this value sits. */
function Scale({ k, v, on }: { k: MetricKey; v: number; on: boolean }) {
  const m = METRIC[k];
  const pct = (x: number) => Math.min(100, (x / m.max) * 100);
  return (
    <span className="vs" aria-hidden="true">
      <span className="vs-band good" style={{ width: `${pct(m.good)}%` }} />
      <span className="vs-band ok" style={{ width: `${pct(m.poor) - pct(m.good)}%` }} />
      <span className="vs-band poor" />
      <i className="vs-mark" style={{ left: on ? `${Math.min(pct(v), 98.5)}%` : "0%" }} />
    </span>
  );
}

function Metric({ k, v, field, on }: { k: MetricKey; v: number | null; field?: boolean; on: boolean }) {
  const m = METRIC[k];
  const [open, setOpen] = useState(false);
  const g = grade(v, m.good, m.poor);
  return (
    <div className={`vm vm-${g ?? "na"}${open ? " open" : ""}`}>
      <button type="button" className="vm-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="vm-l">
          {m.name} <abbr>{m.abbr}</abbr>
        </span>
        <b>{v == null ? "–" : m.fmt(v)}</b>
        <span className="vm-g">{g ? GRADE_TEXT[g] : "Not measured"}</span>
        {v != null && <Scale k={k} v={v} on={on} />}
        <span className="vm-more">
          {open ? "Hide" : "What this means"} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && (
        <div className="vm-info">
          <p>
            {m.what}
            {field ? " Measured on real Chrome visits: 75% of visits were at least this fast." : ""}
          </p>
          <p className="vm-target">
            Good is under <b>{m.fmt(m.good)}</b>; over <b>{m.fmt(m.poor)}</b> is poor.
          </p>
          {g && g !== "good" && (
            <p className="vm-fix">
              <b>How to improve:</b> {m.fix}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** A 0 → N seconds strip showing when the first content and the main content appear. */
function Timeline({ r, on }: { r: VitalsRun; on: boolean }) {
  if (r.fcp == null && r.lcp == null) return null;
  const end = Math.max(3000, Math.ceil(Math.max(r.fcp ?? 0, r.lcp ?? 0) / 1000) * 1000 + 1000);
  const at = (ms: number) => `${(ms / end) * 100}%`;
  const ticks = Array.from({ length: end / 1000 + 1 }, (_, i) => i);
  const lcpG = grade(r.lcp, 2500, 4000);
  return (
    <div className="vtl" role="img" aria-label={`Loading timeline: first content at ${sec(r.fcp)}, main content at ${sec(r.lcp)}, target 2.5 s.`}>
      <div className="vtl-track">
        <span className={`vtl-fill ${lcpG ?? ""}`} style={{ width: on && r.lcp != null ? at(r.lcp) : "0%" }} />
        <span className="vtl-goal" style={{ left: at(2500) }}>
          <em>Target 2.5 s</em>
        </span>
        {r.fcp != null && (
          <span className="vtl-pin fcp" style={{ left: at(r.fcp) }}>
            <em>
              First thing <b>{sec(r.fcp)}</b>
            </em>
          </span>
        )}
        {r.lcp != null && (
          <span className={`vtl-pin lcp ${lcpG ?? ""}`} style={{ left: at(r.lcp) }}>
            <em>
              Main content <b>{sec(r.lcp)}</b>
            </em>
          </span>
        )}
      </div>
      <div className="vtl-ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: at(t * 1000) }}>
            {t}s
          </span>
        ))}
      </div>
    </div>
  );
}

/** The run in plain English: a headline, what a visitor experiences, and the single most useful thing to fix. */
function summarise(r: VitalsRun, other: VitalsRun | null, dev: "mobile" | "desktop"): { head: string; tone: Grade; lines: string[]; fix: string | null } {
  const where = dev === "mobile" ? "a mid-range phone" : "a desktop computer";
  const device = dev === "mobile" ? "phones" : "desktop";
  const lcpG = grade(r.lcp, 2500, 4000);
  const worst = (["lcp", "tbt", "cls", "fcp"] as const)
    .map((k) => ({ k, v: r[k] }))
    .filter((x): x is { k: "lcp" | "tbt" | "cls" | "fcp"; v: number } => x.v != null && x.v > METRIC[x.k].good)
    .sort((a, b) => a.v / METRIC[a.k].poor - b.v / METRIC[b.k].poor)
    .pop();
  const score = r.score ?? 0;
  const tone: Grade = score >= 90 && lcpG === "good" ? "good" : score < 50 || lcpG === "poor" ? "poor" : "ok";
  const head = tone === "good" ? `Fast on ${device}` : tone === "ok" ? `A little slow on ${device}` : `Slow on ${device}`;
  const lines: string[] = [];
  if (r.fcp != null && r.lcp != null)
    lines.push(`On ${where}, something first appears after ${sec(r.fcp)} and the main content after ${sec(r.lcp)}. Google's target for the main content is 2.5 s${r.lcp > 2500 ? `, so visitors wait ${((r.lcp - 2500) / 1000).toFixed(1)} s longer than they should.` : ", and this page beats it."}`);
  if (r.tbt != null) lines.push(r.tbt > 200 ? `While it loads, the page freezes for ${Math.round(r.tbt)} ms as scripts run, so early taps and scrolls are ignored.` : "It reacts to taps and scrolling almost straight away.");
  if (r.cls != null) lines.push(r.cls > 0.1 ? "Content jumps around as it loads, which can make people tap the wrong thing." : "Content stays put while it loads.");
  if (other?.lcp != null && r.lcp != null) lines.push(`On ${dev === "mobile" ? "a desktop" : "a phone"}, the main content appears after ${sec(other.lcp)}.`);
  return { head, tone, lines, fix: worst ? `${METRIC[worst.k].name} (${METRIC[worst.k].abbr}) is the weakest number. ${METRIC[worst.k].fix}` : null };
}

export function VitalsPanel({ vitals }: { vitals: Vitals | null | undefined }) {
  const [dev, setDev] = useState<"mobile" | "desktop">("mobile");
  const [ref, on] = useInView<HTMLElement>();
  if (!vitals) {
    return (
      <section className="panel" aria-label="Core Web Vitals">
        <h2>Core Web Vitals</h2>
        <p className="panel-note">Lighthouse speed data was not available for this scan. The speed checks above use server-side signals only.</p>
      </section>
    );
  }
  const shown = vitals[dev] ? dev : vitals.mobile ? "mobile" : "desktop";
  const run = vitals[shown];
  const other = vitals[shown === "mobile" ? "desktop" : "mobile"];
  const f = vitals.field;
  const sum = run ? summarise(run, other, shown) : null;
  return (
    <>
      <section className="panel vt-panel" aria-label="Speed summary" ref={ref}>
        <div className="panel-head">
          <h2>What visitors experience</h2>
          <div className="seg" role="group" aria-label="Device">
            {(["mobile", "desktop"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={shown === d} disabled={!vitals[d]} onClick={() => setDev(d)}>
                {d === "mobile" ? "Phone" : "Desktop"}
              </button>
            ))}
          </div>
        </div>
        {run && sum && (
          <>
            <div className={`vt-sum vt-${sum.tone}`}>
              <div className="vt-score">
                <b>{run.score ?? "–"}</b>
                <span>/100</span>
              </div>
              <div className="vt-words">
                <h3>{sum.head}</h3>
                {sum.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            </div>
            <Timeline r={run} on={on} />
            {sum.fix && (
              <p className="vt-fix">
                <b>Start here:</b> {sum.fix}
              </p>
            )}
          </>
        )}
      </section>

      <section className="panel" aria-label="Lab measurements">
        <div className="panel-head">
          <h2>The four numbers behind it</h2>
          <span className="panel-tag">Lab test · {shown === "mobile" ? "simulated phone" : "desktop"}</span>
        </div>
        <p className="panel-note">Tap any number to see what it means and how to improve it.</p>
        {run && (
          <div className="vm-grid">
            <Metric k="lcp" v={run.lcp} on={on} />
            <Metric k="fcp" v={run.fcp} on={on} />
            <Metric k="tbt" v={run.tbt} on={on} />
            <Metric k="cls" v={run.cls} on={on} />
          </div>
        )}
      </section>

      <section className="panel" aria-label="Real visitors">
        <div className="panel-head">
          <h2>Real visitors</h2>
          <span className="panel-tag">Chrome field data · last 28 days</span>
        </div>
        {f ? (
          <>
            <p className="panel-note">What people using Chrome actually experienced on this address. Google uses these numbers, not the lab test, when it ranks pages.</p>
            <div className="vm-grid">
              <Metric k="lcp" v={f.lcp} field on={on} />
              <Metric k="inp" v={f.inp} field on={on} />
              <Metric k="cls" v={f.cls} field on={on} />
            </div>
          </>
        ) : (
          <p className="panel-note">Google doesn&rsquo;t have enough real-visitor data for this address yet, usually because it gets too little Chrome traffic. Until it does, the lab test above is the best guide.</p>
        )}
      </section>
    </>
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
          <li><b>Not a compliance certificate.</b> Automated checks find only a share of accessibility problems, and passing them does not mean WCAG compliance. Colour contrast and other rendered-page checks come from Lighthouse (axe-core in a real browser) and appear only when Lighthouse data is available for the scan.</li>
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

/* How many pages the crawl reached, why it stopped there, and what would let it find more. */
const TOOL_NAME: Record<NonNullable<CrawlFix["tool"]>, string> = {
  "sitemap-generator": "Open the Sitemap generator",
  "raw-vs-rendered-html": "Compare raw and rendered HTML",
  "robots-txt-tester": "Test robots.txt",
};
export function CrawlWhyPanel({ crawl, noSitemap, onTool }: { crawl: StoredScan["crawl"]; noSitemap: boolean; onTool: (slug: NonNullable<CrawlFix["tool"]>) => void }) {
  const w = crawlWhy(crawl, { noSitemap });
  const pct = w.known ? Math.max(4, Math.min(100, Math.round((w.crawled / w.known) * 100))) : 100;
  return (
    <section className={`panel cwhy cwhy-${w.kind}`} aria-labelledby="cwhy-h">
      <div className="cwhy-head">
        <div className="cwhy-num" aria-hidden="true">
          <b>{w.crawled}</b>
          {w.known && w.known > w.crawled ? <span>of {w.known}+</span> : <span>{w.crawled === 1 ? "page" : "pages"}</span>}
        </div>
        <div>
          <h2 id="cwhy-h">
            {w.kind === "full"
              ? `We crawled all ${w.crawled} pages we could find`
              : w.kind === "capped"
                ? `We crawled ${w.crawled} pages${w.known && w.known > w.crawled ? ` of at least ${w.known}` : ""}`
                : w.crawled === 1
                  ? "We could only reach the homepage"
                  : `We could only reach ${w.crawled} pages`}
          </h2>
          {w.known && w.known > w.crawled && (
            <div className="cwhy-bar" role="img" aria-label={`${w.crawled} of at least ${w.known} pages crawled`}>
              <i style={{ width: `${pct}%` }} />
            </div>
          )}
          {!w.exact && <p className="cwhy-guess">This report is older, so the reasons below are our best guess.</p>}
        </div>
      </div>
      <div className="cwhy-cols">
        <div>
          <h3>Why it stopped here</h3>
          <ul className="cwhy-list">
            {w.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
        <div>
          <h3>{w.kind === "full" ? "To keep it that way" : "To find more pages"}</h3>
          <ol className="cwhy-fix">
            {w.fixes.map((f) => (
              <li key={f.text}>
                <span>{f.text}</span>
                {f.tool && (
                  <button type="button" className="fnd-link" onClick={() => onTool(f.tool!)}>
                    {TOOL_NAME[f.tool]} <span aria-hidden="true">→</span>
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

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
  const hasPage = !!images?.probed.some((p) => p.page); // reports before this change don't say where each image was
  const pathOf = (u: string) => {
    try {
      const x = new URL(u);
      return x.pathname + x.search || "/";
    } catch {
      return u;
    }
  };
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
          <li><span className="dot na" aria-hidden="true" /><span className="fk">Images found</span><span className="fv">{images.count}{images.pages && images.pages > 1 ? ` across ${images.pages} pages` : ""} ({images.probed.length} checked)</span></li>
        )}
      </ul>
      {images && images.probed.length > 0 && (
        <div className="crawl-wrap">
          <table className="crawl">
            <thead>
              <tr><th>Image</th>{hasPage && <th>Found on</th>}<th>Format</th><th>Size</th></tr>
            </thead>
            <tbody>
              {[...images.probed].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).map((p) => (
                <tr key={p.url} className={(p.bytes ?? 0) > 300_000 ? "bad" : undefined}>
                  <td title={p.url}>{/^https?:\/\//i.test(p.url) ? <a href={p.url} target="_blank" rel="noopener noreferrer nofollow">{file(p.url)}</a> : file(p.url)}</td>
                  {hasPage && <td title={p.page}>{p.page ? pathOf(p.page) : "–"}</td>}
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
