"use client";

import Link from "next/link";
import { useState } from "react";
import { GUIDES } from "@/lib/scan/guides";
import { findingKey } from "@/lib/scan/score";
import { EFFORT_LABEL, effortOf } from "@/lib/scan/effort";
import { evidenceText, MODULE_NAMES, type Finding, type PageTable, type Severity } from "@/lib/scan/types";

const FIRST_ROWS = 10;

const pathOf = (u: string) => {
  try {
    const x = new URL(u);
    return x.pathname + x.search || "/";
  } catch {
    return u;
  }
};
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);

/* Every page a finding affects: the first 10, then all of them in a scrolling box. */
function PagesTable({ t, title }: { t: PageTable; title: string }) {
  const [all, setAll] = useState(false);
  const rows = all ? t.rows : t.rows.slice(0, FIRST_ROWS);
  const n = t.rows.length;
  return (
    <div className="fpt">
      <div className={`fpt-wrap${all ? " all" : ""}`}>
        <table>
          <caption className="sr-only">Pages affected: {title}</caption>
          <thead>
            <tr>
              <th scope="col" className="fpt-n">#</th>
              <th scope="col">Page</th>
              {t.cols.map((c) => <th scope="col" key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.url}-${i}`}>
                <td className="fpt-n">{i + 1}</td>
                <td className="fpt-page">
                  {safeHref(r.url) ? <a href={r.url} target="_blank" rel="noopener noreferrer nofollow">{pathOf(r.url)}</a> : pathOf(r.url)}
                </td>
                {r.cells.map((c, j) => <td key={j}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {n > FIRST_ROWS && (
        <button type="button" className="fnd-link fpt-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${n} pages`}
        </button>
      )}
    </div>
  );
}

const LABEL: Record<Severity, string> = { high: "Important", medium: "Worth fixing", low: "Minor" };

const GROUPS: { sev: Severity; title: string; hint: string }[] = [
  { sev: "high", title: "Fix these first", hint: "These affect visitors or search engines right now." },
  { sev: "medium", title: "Worth improving", hint: "Clear gains, but not urgent." },
  { sev: "low", title: "Minor polish", hint: "Nice to have when you have time." },
];

/* Plain-language list. The headline and "why it matters" are always visible;
   the fix steps and evidence stay behind a "Technical details" toggle. */
function Item({
  f,
  fixed,
  onToggleFixed,
  showModule,
  index,
  gain,
}: {
  f: Finding;
  fixed: boolean;
  onToggleFixed?: (key: string) => void;
  showModule: boolean;
  index: number;
  gain?: number;
}) {
  const [tech, setTech] = useState(false);
  const [copied, setCopied] = useState(false);
  const k = findingKey(f);

  const copyFix = async () => {
    try {
      await navigator.clipboard.writeText(`${f.title}\nWhy it matters: ${f.why}\nHow to fix: ${f.fix}${evidenceText(f) ? `\nEvidence:${f.pages?.rows.length ? "\n" : " "}${evidenceText(f)}` : ""}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <li data-k={k} className={`fnd sev-${f.severity}${fixed ? " is-fixed" : ""}`} style={{ ["--i" as string]: index }}>
      <div className="fnd-row">
        {onToggleFixed && (
          <label className="fnd-check" title={fixed ? "Marked as fixed" : "Mark as fixed"}>
            <input type="checkbox" checked={fixed} onChange={() => onToggleFixed(k)} />
            <span className="sr-only">Mark “{f.title}” as fixed</span>
          </label>
        )}
        <div className="fnd-body">
          <div className="fnd-top">
            <span className="sev">{LABEL[f.severity]}</span>
            {gain ? <span className="gain" title="Points this adds to your overall score once fixed">+{gain} pt{gain === 1 ? "" : "s"}</span> : null}
            <span className={`eff eff-${effortOf(f)}`} title="Rough effort to fix">{EFFORT_LABEL[effortOf(f)]}</span>
            {showModule && <span className="fm">{MODULE_NAMES[f.module]}</span>}
          </div>
          <h3 className="ft">{f.title}</h3>
          <p className="fwhy">{f.why}</p>
          <button type="button" className="fnd-link" aria-expanded={tech} onClick={() => setTech((t) => !t)}>
            {tech ? "Hide technical details" : "Technical details"}
          </button>
          {tech && (
            <div className="fb">
              <p><strong>How to fix.</strong> {f.fix}</p>
              {f.pages?.rows.length ? (
                <div className="fev">
                  <p><strong>Pages affected ({f.pages.rows.length}).</strong></p>
                  <PagesTable t={f.pages} title={f.title} />
                </div>
              ) : (
                f.evidence && <p className="ev"><strong>Evidence.</strong> <code>{f.evidence}</code></p>
              )}
              {GUIDES[f.id] && (
                <Link className="fnd-link" href={`/fix/${f.id}`} target="_blank">
                  Step-by-step guide
                </Link>
              )}
              <button type="button" className="fnd-link" onClick={copyFix}>
                {copied ? "Copied" : "Copy for my developer"}
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function Findings({
  findings,
  title = "What to fix first",
  fixed,
  onToggleFixed,
  grouped = false,
  gains,
}: {
  findings: Finding[];
  title?: string;
  fixed?: Set<string>;
  onToggleFixed?: (key: string) => void;
  gains?: Map<string, number>;
  /** Group by priority with plain-English headings (used on single-area views). */
  grouped?: boolean;
}) {
  const item = (f: Finding, i: number, showModule: boolean) => (
    <Item key={findingKey(f)} f={f} index={i} fixed={!!fixed?.has(findingKey(f))} onToggleFixed={onToggleFixed} showModule={showModule} gain={fixed?.has(findingKey(f)) ? undefined : gains?.get(findingKey(f))} />
  );

  if (!grouped) {
    return (
      <section className="findings" aria-label={title}>
        <div className="fnd-head"><h2>{title}</h2></div>
        <ul>{findings.map((f, i) => item(f, i, true))}</ul>
      </section>
    );
  }

  return (
    <div className="findings-grouped">
      {GROUPS.map((g) => {
        const list = findings.filter((f) => f.severity === g.sev);
        if (!list.length) return null;
        return (
          <section key={g.sev} className="findings" aria-label={g.title}>
            <div className="fnd-head">
              <h2>{g.title}</h2>
              <span className="fnd-hint">{g.hint}</span>
            </div>
            <ul>{list.map((f, i) => item(f, i, false))}</ul>
          </section>
        );
      })}
    </div>
  );
}
