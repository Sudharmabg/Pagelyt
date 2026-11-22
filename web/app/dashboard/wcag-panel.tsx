"use client";

import { useMemo, useState } from "react";
import { criterionUrl, wcagSummary, WCAG_NEW_UNTIL, WCAG_VERSION, type CriterionRow, type CriterionStatus, type LevelCount, type WcagLevel, type WcagSummary } from "@/lib/scan/wcag";
import type { Finding, ScanResult } from "@/lib/scan/types";

/** Whether the "New" badges still show (read once per page load). */
export const WCAG_IS_NEW = Date.now() < WCAG_NEW_UNTIL;

export const NewPill = () => (WCAG_IS_NEW ? <span className="wc-new">New</span> : null);

/* A level's share of criteria as a donut: failing (red) then no issues found (green); the rest is "by hand". */
export function LevelRing({ level, c, size = 56 }: { level: WcagLevel; c: LevelCount; size?: number }) {
  const r = 22;
  const len = 2 * Math.PI * r;
  const fail = (c.fail / c.total) * len;
  const pass = (c.pass / c.total) * len;
  return (
    <svg className="wc-ring" width={size} height={size} viewBox="0 0 54 54" role="img" aria-label={`Level ${level}: ${c.fail} failing, ${c.pass} with no issues found, ${c.manual} to check by hand`}>
      <circle cx="27" cy="27" r={r} className="wr-track" />
      <circle cx="27" cy="27" r={r} className="wr-pass" strokeDasharray={`${pass} ${len}`} strokeDashoffset={-fail} transform="rotate(-90 27 27)" />
      <circle cx="27" cy="27" r={r} className="wr-fail" strokeDasharray={`${fail} ${len}`} transform="rotate(-90 27 27)" />
      <text x="27" y="31" textAnchor="middle">{level}</text>
    </svg>
  );
}

const total = (s: WcagSummary, k: CriterionStatus) => s.levels.A[k] + s.levels.AA[k];

/* Body of the ★ star card on Overview: rings and the headline on wide screens, three count tiles on phones. */
export function WcagStarArt({ s }: { s: WcagSummary }) {
  const fail = total(s, "fail");
  return (
    <span className="wc-sx">
      <span className="wc-sx-rings">
        <LevelRing level="A" c={s.levels.A} size={52} />
        <LevelRing level="AA" c={s.levels.AA} size={52} />
        <span className="wc-sx-head">
          <b className={fail ? "bad" : "ok"}>{fail ? `${fail} failing` : "No failures"}</b>
          <small>{total(s, "manual")} to check by hand · {total(s, "pass")} clear</small>
        </span>
      </span>
      <span className="wc-sx-tiles" aria-hidden="true">
        <span className="f"><b>{fail}</b>failing</span>
        <span className="m"><b>{total(s, "manual")}</b>by hand</span>
        <span className="p"><b>{total(s, "pass")}</b>clear</span>
      </span>
    </span>
  );
}

/* Overview "From this scan" card body: the failing count and a thin failing / clear / by-hand bar. */
export function WcagCardBody({ s }: { s: WcagSummary }) {
  const fail = total(s, "fail");
  const all = s.levels.A.total + s.levels.AA.total;
  const pct = (n: number) => `${(n / all) * 100}%`;
  return (
    <>
      <span className="dc-big">
        <b>{fail}</b>
        <span className="dc-n">{fail === 1 ? "criterion failing" : "criteria failing"}</span>
      </span>
      <span className="wc-bar wc-card-bar" aria-hidden="true">
        <span className="f" style={{ width: pct(fail) }} />
        <span className="p" style={{ width: pct(total(s, "pass")) }} />
        <span className="m" style={{ width: pct(total(s, "manual")) }} />
      </span>
    </>
  );
}

/* Accessibility area: a one-line pointer to the full checklist (its own ★ page). */
export function WcagStrip({ s, onOpen }: { s: WcagSummary; onOpen: () => void }) {
  const fail = total(s, "fail");
  return (
    <button type="button" className={`wc-strip ${fail ? "bad" : "ok"}`} onClick={onOpen}>
      <LevelRing level="AA" c={s.levels.AA} size={40} />
      <span className="wc-strip-txt">
        <b>WCAG {WCAG_VERSION}: {fail ? `${fail} criteri${fail === 1 ? "on" : "a"} failing` : "no automated failures"}</b>
        <small>{total(s, "manual")} more need a person to check</small>
      </span>
      <span className="wc-strip-go">Open checklist <span aria-hidden="true">→</span></span>
    </button>
  );
}

/* WCAG 2.2 Level A and AA checklist for the Accessibility area. Built from the open (not marked fixed) findings,
   so ticking a fix off moves its criterion out of "Failing" once nothing else fails it. Automated checks can only
   prove a failure, so a criterion with nothing found is "No issues found", never "conforms". */

const TABS: { key: CriterionStatus; label: string; empty: string }[] = [
  { key: "fail", label: "Failing", empty: "No criterion fails in the automated checks." },
  { key: "manual", label: "Check by hand", empty: "Every criterion was covered by an automated check." },
  { key: "pass", label: "No issues found", empty: "No criterion passed the automated checks yet." },
];

function LevelTile({ level, c }: { level: WcagLevel; c: LevelCount }) {
  const pct = (n: number) => `${(n / c.total) * 100}%`;
  return (
    <div className={`wc-tile${c.fail ? " bad" : ""}`}>
      <div className="wc-tile-top">
        <span className="wc-lvl">Level {level}</span>
        <span className="wc-of">{c.total} criteria</span>
      </div>
      <div className="wc-bar" aria-hidden="true">
        <span className="f" style={{ width: pct(c.fail) }} />
        <span className="p" style={{ width: pct(c.pass) }} />
        <span className="m" style={{ width: pct(c.manual) }} />
      </div>
      <dl className="wc-nums">
        <div className="f"><dt>Failing</dt><dd>{c.fail}</dd></div>
        <div className="p"><dt>No issues</dt><dd>{c.pass}</dd></div>
        <div className="m"><dt>By hand</dt><dd>{c.manual}</dd></div>
      </dl>
    </div>
  );
}

function Row({ r, onFinding }: { r: CriterionRow; onFinding?: (f: Finding) => void }) {
  return (
    <li className={`wc-row ${r.status}`}>
      <span className="wc-id">{r.id}</span>
      <div className="wc-main">
        <div className="wc-name">
          <a href={criterionUrl(r)} target="_blank" rel="noopener noreferrer">{r.name}<span className="sr-only"> (W3C explanation, opens in a new tab)</span></a>
          <span className={`wc-pill l-${r.level.toLowerCase()}`}>{r.level}</span>
        </div>
        {r.findings.length > 0 && (
          <ul className="wc-fs">
            {r.findings.map((f) => (
              <li key={f.id}>
                {onFinding ? <button type="button" className="fnd-link" onClick={() => onFinding(f)}>{f.title}</button> : f.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function WcagPanel({ findings, wcag, onFinding }: { findings: Finding[]; wcag: ScanResult["wcag"]; onFinding?: (f: Finding) => void }) {
  const s = useMemo(() => wcagSummary(findings, wcag?.tested), [findings, wcag]);
  const failing = s.levels.A.fail + s.levels.AA.fail;
  const manual = s.levels.A.manual + s.levels.AA.manual;
  const [tab, setTab] = useState<CriterionStatus>(failing ? "fail" : "manual");
  const list = s.rows.filter((r) => r.status === tab);
  const count = (k: CriterionStatus) => s.rows.filter((r) => r.status === k).length;

  return (
    <section className="panel wcag" aria-labelledby="wc-h">
      <div className="panel-head">
        <div>
          <p className="wc-eyebrow">WCAG {wcag?.version ?? WCAG_VERSION} · Level A and AA</p>
          <h2 id="wc-h">Accessibility checklist</h2>
        </div>
        <span className={`wc-verdict ${failing ? "bad" : "ok"}`}>{failing ? `${failing} criteri${failing === 1 ? "on" : "a"} failing` : "No automated failures"}</span>
      </div>
      <p className="panel-note">
        {failing
          ? `This site does not yet meet WCAG ${WCAG_VERSION} AA. Fix the failing criteria first, then check the ${manual} that need a person.`
          : `Nothing failed our automated checks. ${manual} criteria (captions, keyboard traps, error messages and more) still need a person to check before you can claim AA.`}
      </p>

      <div className="wc-tiles">
        <LevelTile level="A" c={s.levels.A} />
        <LevelTile level="AA" c={s.levels.AA} />
      </div>

      <div className="wc-tabs" role="group" aria-label="Show criteria">
        {TABS.map((t) => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} aria-controls="wc-list" className={`${t.key}${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
            {t.label} <b>{count(t.key)}</b>
          </button>
        ))}
      </div>
      <div id="wc-list">
        {list.length ? <ul className="wc-list">{list.map((r) => <Row key={r.id} r={r} onFinding={onFinding} />)}</ul> : <p className="panel-note">{TABS.find((t) => t.key === tab)!.empty}</p>}
        {tab === "manual" && <p className="wc-fine">No automated tool can decide these: they need someone to try the site with a keyboard, a screen reader and real content.</p>}
        {tab === "pass" && <p className="wc-fine">Our checks tested these and found nothing. That is a good sign, not proof of conformance.</p>}
      </div>

      {s.bestPractice.length > 0 && (
        <p className="wc-fine">Also {s.bestPractice.length} best-practice issue{s.bestPractice.length === 1 ? "" : "s"} below that WCAG doesn&apos;t require but that help screen reader users.</p>
      )}
      {!wcag && <p className="wc-fine">This report is older than the WCAG checklist, so only the homepage HTML checks count as tested. Rescan for the full picture.</p>}
    </section>
  );
}
