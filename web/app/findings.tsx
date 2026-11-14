"use client";

import { toast } from "./toast";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GUIDES } from "@/lib/scan/guides";
import { findingKey } from "@/lib/scan/score";
import { EFFORT_LABEL, effortOf } from "@/lib/scan/effort";
import { evidenceText, MODULE_NAMES, type Finding, type PageTable, type Severity } from "@/lib/scan/types";
import type { Traffic } from "@/lib/google/gsc-insights";
import type { Visits } from "@/lib/google/ga4-insights";
import { money, type AdSpend } from "@/lib/google/ads-insights";

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

const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

const LABEL: Record<Severity, string> = { high: "Important", medium: "Worth fixing", low: "Minor" };
const SEV_TIP: Record<Severity, string> = {
  high: "Affects visitors or search engines right now. Fix these first.",
  medium: "A clear gain, but not urgent.",
  low: "Polish for when you have time.",
};

const GROUPS: { sev: Severity; title: string; hint: string }[] = [
  { sev: "high", title: "Fix these first", hint: "These affect visitors or search engines right now." },
  { sev: "medium", title: "Worth improving", hint: "Clear gains, but not urgent." },
  { sev: "low", title: "Minor polish", hint: "Nice to have when you have time." },
];

/* The finding's full detail in a side sheet (a bottom sheet on phones): a native modal <dialog>, so focus,
   Escape and the page behind are handled by the browser. Closes on the backdrop too, with a slide-out. */
function FindingDrawer({
  f,
  fixed,
  onToggleFixed,
  onCopy,
  copied,
  onClose,
}: {
  f: Finding;
  fixed: boolean;
  onToggleFixed?: () => void;
  onCopy: () => void;
  copied: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const close = () => {
    const d = ref.current;
    if (!d || d.classList.contains("out")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onClose();
    d.classList.add("out");
    window.setTimeout(onClose, 240);
  };
  return (
    <dialog
      ref={ref}
      className="fdr"
      aria-labelledby="fdr-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="fdr-in">
        <header className="fdr-head">
          <span className={`sev sev-${f.severity}`}>{LABEL[f.severity]}</span>
          <span className="fm">{MODULE_NAMES[f.module]}</span>
          <button type="button" className="fdr-x" aria-label="Close" onClick={close}>×</button>
        </header>
        <h2 id="fdr-title" className="fdr-t">{f.title}</h2>
        <section className="fdr-sec">
          <h3>Why it matters</h3>
          <p>{f.why}</p>
        </section>
        <section className="fdr-sec fdr-fix">
          <h3>How to fix</h3>
          <p>{f.fix}</p>
        </section>
        {f.pages?.rows.length ? (
          <section className="fdr-sec">
            <h3>Pages affected ({f.pages.rows.length})</h3>
            <PagesTable t={f.pages} title={f.title} />
          </section>
        ) : f.evidence ? (
          <section className="fdr-sec">
            <h3>Evidence</h3>
            <code className="fdr-ev">{f.evidence}</code>
          </section>
        ) : null}
        <footer className="fdr-foot">
          {onToggleFixed && (
            <button type="button" className={`btn${fixed ? " ghost" : ""}`} onClick={() => { onToggleFixed(); close(); }}>
              {fixed ? "Reopen this issue" : "Mark as fixed"}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onCopy}>{copied ? "Copied" : "Copy for my developer"}</button>
          {GUIDES[f.id] && (
            <Link className="fnd-link" href={`/fix/${f.id}`} target="_blank">Step-by-step guide</Link>
          )}
        </footer>
      </div>
    </dialog>
  );
}

/* Plain-language list. The headline and "why it matters" are always visible;
   the title or "How to fix" opens the full detail in a side sheet. */
function Item({
  f,
  fixed,
  onToggleFixed,
  showModule,
  index,
  gain,
  traffic,
  visits,
  spend,
}: {
  f: Finding;
  fixed: boolean;
  onToggleFixed?: (key: string) => void;
  showModule: boolean;
  index: number;
  gain?: number;
  /** Google clicks and impressions on the pages this finding affects (Search Console connected). */
  traffic?: Traffic;
  /** Google Analytics visits on the pages this finding affects (Analytics connected). */
  visits?: Visits;
  /** Google Ads spend landing on the pages this finding affects (Google Ads connected). */
  spend?: AdSpend;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const k = findingKey(f);

  const copyFix = async () => {
    try {
      await navigator.clipboard.writeText(`${f.title}\nWhy it matters: ${f.why}\nHow to fix: ${f.fix}${evidenceText(f) ? `\nEvidence:${f.pages?.rows.length ? "\n" : " "}${evidenceText(f)}` : ""}`);
      setCopied(true);
      toast("Fix copied for your developer");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Your browser blocked copying", { tone: "err" });
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
            <span className="sev" data-tip={SEV_TIP[f.severity]}>{LABEL[f.severity]}</span>
            {gain ? <span className="gain" data-tip="Points this adds to your overall score once fixed">+{gain} pt{gain === 1 ? "" : "s"}</span> : null}
            <span className={`eff eff-${effortOf(f)}`} data-tip="Rough effort to fix">{EFFORT_LABEL[effortOf(f)]}</span>
            {showModule && <span className="fm">{MODULE_NAMES[f.module]}</span>}
            {traffic && traffic.impressions > 0 && (
              <span className="trf" data-tip={`Google Search, last 28 days, on ${traffic.scope === "site" ? "the whole site" : traffic.scope === "homepage" ? "the homepage" : `the ${traffic.pages} affected page${traffic.pages === 1 ? "" : "s"}`}: ${traffic.clicks.toLocaleString("en-GB")} clicks, ${traffic.impressions.toLocaleString("en-GB")} impressions`}>
                {compact(traffic.clicks)} Google clicks{traffic.scope === "site" ? " · site-wide" : ""}
              </span>
            )}
            {visits && visits.sessions > 0 && (
              <span className="trf vis" data-tip={`Google Analytics, last 28 days, on ${visits.scope === "site" ? "the whole site" : visits.scope === "homepage" ? "the homepage" : `the ${visits.pages} affected page${visits.pages === 1 ? "" : "s"}`}: ${visits.sessions.toLocaleString("en-GB")} visits, ${Math.round((visits.engaged / visits.sessions) * 100)}% engaged`}>
                {compact(visits.sessions)} visits{visits.scope === "site" ? " · site-wide" : ""}
              </span>
            )}
            {spend && spend.cost >= 1 && spend.scope !== "site" && (
              <span className="trf ads" data-tip={`Google Ads, last 28 days: ${money(spend.cost, spend.currency, 2)} of ad spend and ${spend.clicks.toLocaleString("en-GB")} ad clicks landing on ${spend.scope === "homepage" ? "the homepage" : `the ${spend.pages} affected page${spend.pages === 1 ? "" : "s"}`}`}>
                {money(spend.cost, spend.currency)} ad spend
              </span>
            )}
          </div>
          <h3 className="ft">
            <button type="button" className="ft-open" aria-haspopup="dialog" onClick={() => setOpen(true)}>{f.title}</button>
          </h3>
          <p className="fwhy">{f.why}</p>
          <button type="button" className="fnd-link" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            How to fix <span aria-hidden="true">→</span>
          </button>
          {open && (
            <FindingDrawer
              f={f}
              fixed={fixed}
              onToggleFixed={onToggleFixed ? () => onToggleFixed(k) : undefined}
              onCopy={copyFix}
              copied={copied}
              onClose={() => setOpen(false)}
            />
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
  traffic,
  visits,
  spend,
}: {
  findings: Finding[];
  title?: string;
  fixed?: Set<string>;
  onToggleFixed?: (key: string) => void;
  gains?: Map<string, number>;
  traffic?: Map<string, Traffic>;
  visits?: Map<string, Visits>;
  spend?: Map<string, AdSpend>;
  /** Group by priority with plain-English headings (used on single-area views). */
  grouped?: boolean;
}) {
  const item = (f: Finding, i: number, showModule: boolean) => (
    <Item key={findingKey(f)} f={f} index={i} fixed={!!fixed?.has(findingKey(f))} onToggleFixed={onToggleFixed} showModule={showModule} gain={fixed?.has(findingKey(f)) ? undefined : gains?.get(findingKey(f))} traffic={traffic?.get(findingKey(f))} visits={visits?.get(findingKey(f))} spend={spend?.get(findingKey(f))} />
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
