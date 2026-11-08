import type { Finding } from "./types";

/* Rendered accessibility checks from Lighthouse (it runs axe-core in a real Chrome), requested in the
   same PageSpeed call as the speed test. This adds what static HTML checks cannot see, such as colour
   contrast and ARIA that is only wired up by JavaScript. Where Lighthouse checked the same thing as one of
   our static checks, its rendered result replaces the static one so nothing is reported twice. */

export type LhAudit = {
  score?: number | null;
  scoreDisplayMode?: string;
  title?: string;
  description?: string;
  details?: { items?: { node?: { snippet?: string; selector?: string; nodeLabel?: string } }[] };
};
export type LhCategory = { score?: number | null; auditRefs?: { id: string; weight: number }[] };

export type A11yResult = { score: number | null; failed: { id: string; title: string; why: string; weight: number; count: number; evidence: string }[]; audited: string[] };

/** Lighthouse audit id → our static check ids that it supersedes. */
const COVERS: Record<string, string[]> = {
  "image-alt": ["a11y-alt"],
  label: ["form-labels"],
  "link-name": ["empty-links"],
  "button-name": ["empty-buttons"],
  "html-has-lang": ["a11y-lang"],
  "document-title": ["a11y-title"],
  "meta-viewport": ["zoom-blocked"],
  "heading-order": ["heading-skip"],
  "landmark-one-main": ["no-main"],
  bypass: ["no-skip-link"],
  tabindex: ["positive-tabindex"],
  "aria-valid-attr-value": ["aria-broken-ref"],
};

/** Plain text from Lighthouse's markdown description, without the "Learn more" link. */
const plain = (md = "") =>
  md.replace(/\s*\[Learn (more|how)[^\]]*\]\([^)]*\)\.?/gi, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/`/g, "").trim();

export function parseA11y(cat: LhCategory | undefined, audits: Record<string, LhAudit>): A11yResult | null {
  if (!cat?.auditRefs?.length) return null;
  const failed: A11yResult["failed"] = [];
  const audited: string[] = [];
  for (const ref of cat.auditRefs) {
    const a = audits[ref.id];
    if (!a || a.scoreDisplayMode === "notApplicable" || a.scoreDisplayMode === "manual" || a.score == null) continue;
    audited.push(ref.id);
    if (a.score >= 1 || ref.weight <= 0) continue;
    const items = a.details?.items ?? [];
    const evidence = items
      .slice(0, 3)
      .map((i) => (i.node?.snippet || i.node?.selector || i.node?.nodeLabel || "").replace(/\s+/g, " ").slice(0, 120))
      .filter(Boolean)
      .join(" · ");
    failed.push({ id: ref.id, title: plain(a.title).replace(/\.$/, "") || ref.id, why: plain(a.description), weight: ref.weight, count: items.length, evidence });
  }
  return { score: typeof cat.score === "number" ? Math.round(cat.score * 100) : null, failed, audited };
}

/** Static accessibility check ids that Lighthouse has re-checked on the rendered page. */
export function coveredStaticIds(r: A11yResult): Set<string> {
  return new Set(r.audited.flatMap((id) => COVERS[id] ?? []));
}

export function a11yFindings(r: A11yResult): Finding[] {
  return r.failed.map((f) => ({
    id: `lh-${f.id}`,
    module: "accessibility" as const,
    // Lighthouse weights: 10 = critical (names, labels, lang), 7 = serious (contrast), 3 or less = moderate.
    severity: f.weight >= 10 ? ("high" as const) : f.weight >= 7 ? ("medium" as const) : ("low" as const),
    title: f.count > 1 ? `${f.title} (${f.count} elements)` : f.title,
    why: f.why || "Found on the rendered page by an automated accessibility test (axe-core, via Lighthouse).",
    fix: f.id === "color-contrast"
      ? "Darken the text or lighten the background until the contrast ratio is at least 4.5:1 (3:1 for large text). Browser dev tools show the ratio when you inspect an element."
      : "Fix each element listed in the evidence, then rescan. Lighthouse in Chrome DevTools shows the same check with the exact elements highlighted.",
    evidence: f.evidence || undefined,
  }));
}
