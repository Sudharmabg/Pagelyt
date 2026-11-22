import Link from "next/link";
import { CRITERIA } from "@/lib/scan/wcag";

/* Homepage "WCAG 2.2 checklist" section: what the new checklist in every report looks like. Two level rings fill
   in as the section scrolls into view, next to a short sample list (failing, check by hand, no issues found).
   Sample numbers, not a real site. The copy never says "compliant" or "conforms": automated checks can only
   prove a failure. */

const TOTAL = { A: CRITERIA.filter((c) => c.level === "A").length, AA: CRITERIA.filter((c) => c.level === "AA").length };
const SAMPLE = {
  A: { fail: 3, pass: 9 },
  AA: { fail: 1, pass: 4 },
};
const FAIL = SAMPLE.A.fail + SAMPLE.AA.fail;
const PASS = SAMPLE.A.pass + SAMPLE.AA.pass;
const MANUAL = TOTAL.A + TOTAL.AA - FAIL - PASS;

type Status = "fail" | "manual" | "pass";
const ROWS: { id: string; name: string; level: "A" | "AA"; status: Status; note: string }[] = [
  { id: "1.4.3", name: "Contrast (Minimum)", level: "AA", status: "fail", note: "6 text elements below 4.5:1" },
  { id: "2.4.4", name: "Link Purpose (In Context)", level: "A", status: "fail", note: "2 icon links with no name" },
  { id: "1.2.2", name: "Captions (Prerecorded)", level: "A", status: "manual", note: "A person checks your videos" },
  { id: "3.1.1", name: "Language of Page", level: "A", status: "pass", note: "No issues found" },
];
const MARK: Record<Status, string> = { fail: "✕", manual: "?", pass: "✓" };
const LABEL: Record<Status, string> = { fail: "Failing", manual: "Check by hand", pass: "No issues found" };

const POINTS: { t: string; s: string; d: string }[] = [
  { t: "Every issue tagged with its rule", s: "Each accessibility finding shows its WCAG 2.2 criterion and level, with a link to the W3C explanation.", d: "M4 7h10M4 12h16M4 17h8M17 4l3 3-3 3" },
  { t: "Failing rules first, with the fix", s: "See which Level A and AA rules your site breaks today and the plain-English change for each one.", d: "M12 3 3 20h18L12 3zM12 10v4M12 17v.5" },
  { t: "Honest about what tools can't test", s: "Captions, keyboard traps and error messages need a person. We list those for you instead of guessing.", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17v.5" },
];

function Ring({ level, fail, pass, total, i }: { level: "A" | "AA"; fail: number; pass: number; total: number; i: number }) {
  const r = 40;
  const len = 2 * Math.PI * r;
  const f = (fail / total) * len;
  const p = (pass / total) * len;
  return (
    <div className="hw-ring" style={{ ["--i" as string]: i }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="hw-track" />
        <circle cx="50" cy="50" r={r} className="hw-pass" style={{ ["--da" as string]: `${p} ${len}` }} strokeDashoffset={-f} transform="rotate(-90 50 50)" />
        <circle cx="50" cy="50" r={r} className="hw-fail" style={{ ["--da" as string]: `${f} ${len}` }} transform="rotate(-90 50 50)" />
      </svg>
      <span className="hw-ring-in">
        <b>{level}</b>
        <small>{total} rules</small>
      </span>
    </div>
  );
}

export function WcagSection({ onGo }: { onGo: () => void }) {
  return (
    <section className="sec hw-sec" id="wcag" aria-labelledby="hw-h">
      <div className="container">
        <div className="hw-wrap" data-r>
          <div className="hw-copy">
            <p className="hw-eyebrow"><span className="hw-new">New</span>WCAG 2.2 checklist</p>
            <h2 className="title" id="hw-h">See what blocks WCAG 2.2 AA, rule by rule.</h2>
            <p className="lead">
              Every report now includes a checklist of all {TOTAL.A + TOTAL.AA} Level A and AA success criteria for your homepage. You
              see which rules fail and how to fix them, and which ones still need a person to check.
            </p>
            <ul className="hw-points">
              {POINTS.map((p, i) => (
                <li key={p.t} style={{ ["--i" as string]: i }}>
                  <span className="hw-pi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.d} /></svg></span>
                  <span><b>{p.t}</b><small>{p.s}</small></span>
                </li>
              ))}
            </ul>
            <div className="hw-act">
              <button type="button" className="btn" onClick={onGo}>Check my site <span aria-hidden="true">→</span></button>
              <Link href="/features/wcag-checklist" className="hw-more">How the checklist works <span aria-hidden="true">→</span></Link>
            </div>
          </div>

          <figure className="hw-viz" aria-label={`Example WCAG 2.2 checklist: ${FAIL} rules failing, ${MANUAL} to check by hand, ${PASS} with no issues found`}>
            <div className="hw-viz-head">
              <span className="hw-viz-site">yourwebsite.com</span>
              <span className="hw-viz-tag">WCAG 2.2 · A and AA</span>
            </div>
            <div className="hw-sum">
              <div className="hw-rings">
                <Ring level="A" fail={SAMPLE.A.fail} pass={SAMPLE.A.pass} total={TOTAL.A} i={0} />
                <Ring level="AA" fail={SAMPLE.AA.fail} pass={SAMPLE.AA.pass} total={TOTAL.AA} i={1} />
              </div>
              <dl className="hw-nums">
                <div className="fail"><dt>Failing</dt><dd>{FAIL}</dd></div>
                <div className="manual"><dt>By hand</dt><dd>{MANUAL}</dd></div>
                <div className="pass"><dt>No issues</dt><dd>{PASS}</dd></div>
              </dl>
            </div>
            <ul className="hw-list">
              {ROWS.map((r, i) => (
                <li key={r.id} className={r.status} style={{ ["--i" as string]: i }}>
                  <span className="hw-mark" aria-hidden="true">{MARK[r.status]}</span>
                  <span className="hw-row">
                    <b><span className="hw-id">{r.id}</span> {r.name}</b>
                    <small><span className="sr-only">{LABEL[r.status]}: </span>{r.note}</small>
                  </span>
                  <span className={`hw-lvl l-${r.level.toLowerCase()}`}>{r.level}</span>
                </li>
              ))}
            </ul>
            <figcaption className="hw-cap">Sample report. A clean automated check is a good sign, not proof of conformance.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
