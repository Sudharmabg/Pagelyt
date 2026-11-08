"use client";

import Link from "next/link";
import { useState } from "react";
import { GUIDES } from "@/lib/scan/guides";
import { findingKey } from "@/lib/scan/score";
import { EFFORT_LABEL, effortOf } from "@/lib/scan/effort";
import { MODULE_NAMES, type Finding, type Severity } from "@/lib/scan/types";

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
      await navigator.clipboard.writeText(`${f.title}\nWhy it matters: ${f.why}\nHow to fix: ${f.fix}${f.evidence ? `\nEvidence: ${f.evidence}` : ""}`);
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
              {f.evidence && <p className="ev"><strong>Evidence.</strong> <code>{f.evidence}</code></p>}
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
