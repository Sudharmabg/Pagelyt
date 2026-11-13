"use client";

import { evidenceText, MODULE_NAMES, type Finding } from "@/lib/scan/types";
import type { ToolContext } from "@/lib/scan/tools-context";
import { CATEGORIES, TOOL_LIST, TOOLS_BY_SLUG, type ToolInfo, type ToolSlug } from "./catalog";
import { TONE, ToolIcon } from "./icons";
import { VIEWS } from "./tool-view";

/* The scan findings each tool answers. A tool with none here still shows its Missing items table, with a
   "nothing missing" row. */
const FINDINGS_BY_TOOL: Record<ToolSlug, string[]> = {
  "ai-bot-checker": ["ai-blocked"],
  "llms-txt-generator": ["no-llms"],
  "robots-txt-tester": ["no-robots", "ai-blocked", "no-sitemap"],
  "robots-txt-generator": ["no-robots", "ai-blocked", "no-sitemap"],
  "hreflang-checker": ["hreflang-broken", "hreflang-conflict", "hreflang-invalid", "hreflang-no-default", "hreflang-no-return", "hreflang-no-self", "hreflang-relative"],
  "serp-preview": ["no-title", "title-length", "no-description", "description-length", "no-og"],
  "schema-markup-generator": ["no-structured-data", "bad-json-ld", "schema-required", "schema-recommended", "no-faq"],
  "bulk-schema-checker": ["no-structured-data", "bad-json-ld", "schema-required", "schema-recommended", "crawl-schema-incomplete"],
  "security-headers-generator": ["hsts", "csp", "clickjacking", "nosniff", "referrer"],
  "domain-age-checker": ["domain-expired", "domain-expiring"],
  "google-review-link-generator": [],
  "sitemap-generator": ["no-sitemap", "crawl-noindex-in-sitemap", "crawl-orphan-pages"],
  "raw-vs-rendered-html": [],
};

const RANK = { high: 0, medium: 1, low: 2 } as const;
const PRIORITY = { high: "Important", medium: "Worth fixing", low: "Minor" } as const;

/** This scan's open findings that a tool fixes, most important first. */
export function missingFor(slug: ToolSlug, findings: Finding[]): Finding[] {
  const ids = FINDINGS_BY_TOOL[slug];
  return findings.filter((f) => ids.includes(f.id)).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

/** How many of this scan's findings some tool can fix (each finding counted once). */
export function fixableCount(findings: Finding[]): number {
  const ids = new Set(Object.values(FINDINGS_BY_TOOL).flat());
  return findings.filter((f) => ids.has(f.id)).length;
}

/** Every tool, the ones with something to fix first (most items first), then catalogue order. */
export function toolsByNeed(findings: Finding[]): { t: ToolInfo; n: number }[] {
  return TOOL_LIST.map((t, i) => ({ t, n: missingFor(t.slug, findings).length, i })).sort((a, b) => b.n - a.n || a.i - b.i);
}

/* One tool inside the dashboard: what this scan says is missing, as a table, then the tool itself, pre-filled. */
export function DashTool({ slug, ctx, findings }: { slug: ToolSlug; ctx: ToolContext; findings: Finding[] }) {
  const t = TOOLS_BY_SLUG.get(slug)!;
  const View = VIEWS[slug];
  const missing = missingFor(slug, findings);
  return (
    <div className={`dtool ${TONE[t.category]}`}>
      <section className="panel tmiss" aria-labelledby="tmiss-h">
        <h2 id="tmiss-h">
          Missing items
          <span className={`tmiss-n${missing.length ? "" : " ok"}`}>{missing.length ? `${missing.length} to fix` : "Nothing missing"}</span>
        </h2>
        <div className="tmiss-wrap">
          <table className="tmiss-t">
            <thead>
              <tr><th scope="col">#</th><th scope="col">Missing item</th><th scope="col">Priority</th><th scope="col">Where</th></tr>
            </thead>
            <tbody>
              {missing.length ? (
                missing.map((f, i) => (
                  <tr key={f.id + f.title}>
                    <td className="tmiss-i">{i + 1}</td>
                    <td><b>{f.title}</b><small>{f.fix}</small></td>
                    <td><span className={`tmiss-sev sev-${f.severity}`}>{PRIORITY[f.severity]}</span></td>
                    <td className="tmiss-where">{evidenceText(f) || `${MODULE_NAMES[f.module]} · homepage`}</td>
                  </tr>
                ))
              ) : (
                <tr className="tmiss-none">
                  <td className="tmiss-i">✓</td>
                  <td colSpan={3}>This scan found nothing for {t.name.toLowerCase().startsWith("the ") ? t.name : `the ${t.name}`} to fix on {ctx.host}. You can still use it below.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="tshell">
        <div className="tshell-head">
          <span className="tshell-ic"><ToolIcon slug={t.slug} size={20} /></span>
          <b>{t.name}</b>
          <small>{t.kind === "checker" ? "We fetch the site from our server" : "Runs in your browser"}</small>
        </div>
        <div className="tshell-body">
          <div className="tools">
            <p className="tctx" role="status">Pre-filled from your scan of <b>{ctx.host}</b>. Check everything before you publish it.</p>
            <View key={slug} ctx={ctx} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Every tool as a card: the ones that fix this scan's findings first, then by category. */
export function DashToolGrid({ findings, onOpen }: { findings: Finding[]; onOpen: (s: ToolSlug) => void }) {
  const fixing = toolsByNeed(findings).filter((x) => x.n > 0).map((x) => x.t);
  return (
    <div className="dtools">
      {fixing.length > 0 && (
        <section className="dtools-group dtools-fix" aria-labelledby="dt-fix">
          <h3 id="dt-fix"><span className="dtools-dot" aria-hidden="true" />Fix what this scan found</h3>
          <ul>{fixing.map((t, i) => <Card key={t.slug} t={t} i={i} n={missingFor(t.slug, findings).length} onOpen={onOpen} />)}</ul>
        </section>
      )}
      {CATEGORIES.map((c) => {
        const list = TOOL_LIST.filter((t) => t.category === c.name);
        if (!list.length) return null;
        const id = `dt-${TONE[c.name]}`;
        return (
          <section key={c.name} className={`dtools-group ${TONE[c.name]}`} aria-labelledby={id}>
            <h3 id={id}>{c.name}<small>{c.text}</small></h3>
            <ul>{list.map((t, i) => <Card key={t.slug} t={t} i={i} n={missingFor(t.slug, findings).length} onOpen={onOpen} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}

function Card({ t, i, n, onOpen }: { t: ToolInfo; i: number; n: number; onOpen: (s: ToolSlug) => void }) {
  return (
    <li style={{ ["--i" as string]: i }}>
      <button type="button" className={`dt-card ${TONE[t.category]}`} onClick={() => onOpen(t.slug)}>
        <span className="dt-top">
          <span className="dt-ic"><ToolIcon slug={t.slug} size={20} /></span>
          {n > 0 ? <span className="dt-fix">{n} missing</span> : t.paid ? <span className="dt-paid">Paid</span> : <span className="dt-kind">{t.kind === "checker" ? "Checker" : "Generator"}</span>}
        </span>
        <b>{t.name}</b>
        <span className="dt-txt">{t.blurb}</span>
        <span className="dt-go">Open tool <span aria-hidden="true">→</span></span>
      </button>
    </li>
  );
}
