import type { Finding } from "./types";

/* WCAG 2.2 Level A and AA success criteria, and which of our checks test each one.
   Findings carry no WCAG data of their own: the criteria come from the finding id, so reports saved before
   this file existed get tagged too. Checks that only reflect good practice (no main landmark, heading order)
   map to no criterion and are labelled "Best practice". */

export type WcagLevel = "A" | "AA";
export type Criterion = { id: string; name: string; level: WcagLevel };

export const WCAG_VERSION = "2.2";

/** All 55 Level A and AA criteria of WCAG 2.2 (4.1.1 Parsing was removed in 2.2). */
export const CRITERIA: Criterion[] = (
  [
    ["1.1.1", "Non-text Content", "A"],
    ["1.2.1", "Audio-only and Video-only (Prerecorded)", "A"],
    ["1.2.2", "Captions (Prerecorded)", "A"],
    ["1.2.3", "Audio Description or Media Alternative (Prerecorded)", "A"],
    ["1.2.4", "Captions (Live)", "AA"],
    ["1.2.5", "Audio Description (Prerecorded)", "AA"],
    ["1.3.1", "Info and Relationships", "A"],
    ["1.3.2", "Meaningful Sequence", "A"],
    ["1.3.3", "Sensory Characteristics", "A"],
    ["1.3.4", "Orientation", "AA"],
    ["1.3.5", "Identify Input Purpose", "AA"],
    ["1.4.1", "Use of Color", "A"],
    ["1.4.2", "Audio Control", "A"],
    ["1.4.3", "Contrast (Minimum)", "AA"],
    ["1.4.4", "Resize Text", "AA"],
    ["1.4.5", "Images of Text", "AA"],
    ["1.4.10", "Reflow", "AA"],
    ["1.4.11", "Non-text Contrast", "AA"],
    ["1.4.12", "Text Spacing", "AA"],
    ["1.4.13", "Content on Hover or Focus", "AA"],
    ["2.1.1", "Keyboard", "A"],
    ["2.1.2", "No Keyboard Trap", "A"],
    ["2.1.4", "Character Key Shortcuts", "A"],
    ["2.2.1", "Timing Adjustable", "A"],
    ["2.2.2", "Pause, Stop, Hide", "A"],
    ["2.3.1", "Three Flashes or Below Threshold", "A"],
    ["2.4.1", "Bypass Blocks", "A"],
    ["2.4.2", "Page Titled", "A"],
    ["2.4.3", "Focus Order", "A"],
    ["2.4.4", "Link Purpose (In Context)", "A"],
    ["2.4.5", "Multiple Ways", "AA"],
    ["2.4.6", "Headings and Labels", "AA"],
    ["2.4.7", "Focus Visible", "AA"],
    ["2.4.11", "Focus Not Obscured (Minimum)", "AA"],
    ["2.5.1", "Pointer Gestures", "A"],
    ["2.5.2", "Pointer Cancellation", "A"],
    ["2.5.3", "Label in Name", "A"],
    ["2.5.4", "Motion Actuation", "A"],
    ["2.5.7", "Dragging Movements", "AA"],
    ["2.5.8", "Target Size (Minimum)", "AA"],
    ["3.1.1", "Language of Page", "A"],
    ["3.1.2", "Language of Parts", "AA"],
    ["3.2.1", "On Focus", "A"],
    ["3.2.2", "On Input", "A"],
    ["3.2.3", "Consistent Navigation", "AA"],
    ["3.2.4", "Consistent Identification", "AA"],
    ["3.2.6", "Consistent Help", "A"],
    ["3.3.1", "Error Identification", "A"],
    ["3.3.2", "Labels or Instructions", "A"],
    ["3.3.3", "Error Suggestion", "AA"],
    ["3.3.4", "Error Prevention (Legal, Financial, Data)", "AA"],
    ["3.3.7", "Redundant Entry", "A"],
    ["3.3.8", "Accessible Authentication (Minimum)", "AA"],
    ["4.1.2", "Name, Role, Value", "A"],
    ["4.1.3", "Status Messages", "AA"],
  ] as const
).map(([id, name, level]) => ({ id, name, level }));

const BY_ID = new Map(CRITERIA.map((c) => [c.id, c]));

/** W3C "Understanding" page for a criterion. */
export const criterionUrl = (c: Criterion) =>
  `https://www.w3.org/WAI/WCAG22/Understanding/${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** Our static HTML checks (always run on the homepage) → criteria. An empty list means best practice only. */
const STATIC: Record<string, string[]> = {
  "a11y-alt": ["1.1.1"],
  "form-labels": ["1.3.1", "3.3.2", "4.1.2"],
  "empty-links": ["2.4.4", "4.1.2"],
  "empty-buttons": ["4.1.2"],
  "a11y-lang": ["3.1.1"],
  "a11y-title": ["2.4.2"],
  "zoom-blocked": ["1.4.4"],
  "no-skip-link": ["2.4.1"],
  "positive-tabindex": ["2.4.3"],
  "aria-broken-ref": ["1.3.1", "4.1.2"],
  "role-button-focus": ["2.1.1", "4.1.2"],
  "focus-removed": ["2.4.7"],
  "no-main": [],
  "heading-skip": [],
};

/** Lighthouse accessibility audits (axe-core rules) → criteria, from axe's own WCAG tags. Audits missing here, or
    with an empty list, are axe best-practice rules. */
const LIGHTHOUSE: Record<string, string[]> = {
  "area-alt": ["1.1.1", "2.4.4", "4.1.2"],
  "aria-allowed-attr": ["4.1.2"],
  "aria-command-name": ["4.1.2"],
  "aria-conditional-attr": ["4.1.2"],
  "aria-deprecated-role": ["4.1.2"],
  "aria-hidden-body": ["4.1.2"],
  "aria-hidden-focus": ["4.1.2"],
  "aria-input-field-name": ["4.1.2"],
  "aria-meter-name": ["1.1.1"],
  "aria-progressbar-name": ["1.1.1"],
  "aria-prohibited-attr": ["4.1.2"],
  "aria-required-attr": ["4.1.2"],
  "aria-required-children": ["1.3.1"],
  "aria-required-parent": ["1.3.1"],
  "aria-roles": ["4.1.2"],
  "aria-toggle-field-name": ["4.1.2"],
  "aria-tooltip-name": ["4.1.2"],
  "aria-valid-attr": ["4.1.2"],
  "aria-valid-attr-value": ["4.1.2"],
  "autocomplete-valid": ["1.3.5"],
  "avoid-inline-spacing": ["1.4.12"],
  blink: ["2.2.2"],
  "button-name": ["4.1.2"],
  bypass: ["2.4.1"],
  "color-contrast": ["1.4.3"],
  "css-orientation-lock": ["1.3.4"],
  "definition-list": ["1.3.1"],
  dlitem: ["1.3.1"],
  "document-title": ["2.4.2"],
  "duplicate-id-aria": ["4.1.2"],
  "frame-focusable-content": ["2.1.1"],
  "frame-title": ["4.1.2"],
  "html-has-lang": ["3.1.1"],
  "html-lang-valid": ["3.1.1"],
  "html-xml-lang-mismatch": ["3.1.1"],
  "image-alt": ["1.1.1"],
  "input-button-name": ["4.1.2"],
  "input-image-alt": ["1.1.1", "4.1.2"],
  label: ["1.3.1", "4.1.2"],
  "label-content-name-mismatch": ["2.5.3"],
  "link-in-text-block": ["1.4.1"],
  "link-name": ["2.4.4", "4.1.2"],
  list: ["1.3.1"],
  listitem: ["1.3.1"],
  marquee: ["2.2.2"],
  "meta-refresh": ["2.2.1"],
  "meta-viewport": ["1.4.4"],
  "nested-interactive": ["4.1.2"],
  "no-autoplay-audio": ["1.4.2"],
  "object-alt": ["1.1.1"],
  "p-as-heading": ["1.3.1"],
  "role-img-alt": ["1.1.1"],
  "scrollable-region-focusable": ["2.1.1"],
  "select-name": ["4.1.2"],
  "server-side-image-map": ["2.1.1"],
  "summary-name": ["4.1.2"],
  "svg-img-alt": ["1.1.1"],
  "table-fake-caption": ["1.3.1"],
  "target-size": ["2.5.8"],
  "td-has-header": ["1.3.1"],
  "td-headers-attr": ["1.3.1"],
  "th-has-data-cells": ["1.3.1"],
  "valid-lang": ["3.1.2"],
  "video-caption": ["1.2.2"],
};

const ids = (list: string[] | undefined) => (list ?? []).map((id) => BY_ID.get(id)).filter((c): c is Criterion => !!c);

/** The WCAG criteria a finding fails. Empty for best-practice checks and for findings outside accessibility. */
export function criteriaOf(f: Pick<Finding, "id" | "module">): Criterion[] {
  if (f.module !== "accessibility") return [];
  return ids(f.id.startsWith("lh-") ? LIGHTHOUSE[f.id.slice(3)] : STATIC[f.id]);
}

/** Short tag for a finding: "WCAG 1.4.3 · AA", "WCAG 1.3.1 +2 · A", or "Best practice". */
export function wcagTag(f: Pick<Finding, "id" | "module">): string | null {
  if (f.module !== "accessibility") return null;
  const cs = criteriaOf(f);
  if (!cs.length) return "Best practice";
  const level = cs.some((c) => c.level === "A") ? "A" : "AA";
  return `WCAG ${cs[0].id}${cs.length > 1 ? ` +${cs.length - 1}` : ""} · ${level}`;
}

/** Criteria our checks actually tested in a scan: every static check, plus each Lighthouse audit that applied to
    the page (`audited`). Stored on the result so a criterion with no failures can be called "passed". */
export function testedCriteria(audited: string[]): string[] {
  const out = new Set<string>();
  for (const list of Object.values(STATIC)) list.forEach((id) => out.add(id));
  for (const a of audited) (LIGHTHOUSE[a] ?? []).forEach((id) => out.add(id));
  return CRITERIA.filter((c) => out.has(c.id)).map((c) => c.id);
}

export type CriterionStatus = "fail" | "pass" | "manual";
export type CriterionRow = Criterion & { status: CriterionStatus; findings: Finding[] };
export type LevelCount = { fail: number; pass: number; manual: number; total: number };
export type WcagSummary = { rows: CriterionRow[]; levels: Record<WcagLevel, LevelCount>; bestPractice: Finding[] };

/** Status of every A and AA criterion. `findings`: the open accessibility findings. `tested`: from the scan
    result (older reports: the static checks only). A criterion fails when an open finding maps to it, passes
    when a check tested it and found nothing, and otherwise needs a person to check it. */
export function wcagSummary(findings: Finding[], tested?: string[]): WcagSummary {
  const ran = new Set(tested ?? testedCriteria([]));
  const failing = new Map<string, Finding[]>();
  const bestPractice: Finding[] = [];
  for (const f of findings) {
    if (f.module !== "accessibility") continue;
    const cs = criteriaOf(f);
    if (!cs.length) bestPractice.push(f);
    for (const c of cs) failing.set(c.id, [...(failing.get(c.id) ?? []), f]);
  }
  const rows: CriterionRow[] = CRITERIA.map((c) => {
    const fs = failing.get(c.id) ?? [];
    return { ...c, findings: fs, status: fs.length ? "fail" : ran.has(c.id) ? "pass" : "manual" };
  });
  const count = (level: WcagLevel): LevelCount => {
    const r = rows.filter((x) => x.level === level);
    return { fail: r.filter((x) => x.status === "fail").length, pass: r.filter((x) => x.status === "pass").length, manual: r.filter((x) => x.status === "manual").length, total: r.length };
  };
  return { rows, levels: { A: count("A"), AA: count("AA") }, bestPractice };
}

/** The checklist launched on 2026-11-20; its "New" badges hide themselves after this date. */
export const WCAG_NEW_UNTIL = Date.UTC(2026, 11, 20);

/** Every A and AA criterion with its status and the issues behind it, as CSV rows (header first). */
export function wcagCsvRows(s: WcagSummary): string[][] {
  const label: Record<CriterionStatus, string> = { fail: "Failing", pass: "No issues found", manual: "Check by hand" };
  return [
    ["Criterion", "Name", "Level", "Status", "Issues found", "W3C explanation"],
    ...s.rows.map((r) => [r.id, r.name, r.level, label[r.status], r.findings.map((f) => f.title).join("; "), criterionUrl(r)]),
  ];
}
