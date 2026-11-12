"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ToolContext, ToolId } from "@/lib/scan/tools-context";
import { CATEGORIES, TOOL_LIST, TOOLS_BY_SLUG, type ToolInfo, type ToolSlug } from "./catalog";
import { TONE, ToolIcon } from "./icons";
import { VIEWS } from "./tool-view";

/* Which of the scan's fix lists each tool answers (see TOOL_FIXES). */
const FIXES_BY_TOOL: Partial<Record<ToolSlug, ToolId>> = {
  "llms-txt-generator": "llms",
  "robots-txt-generator": "robots",
  "robots-txt-tester": "robots",
  "schema-markup-generator": "schema",
  "bulk-schema-checker": "schema",
  "serp-preview": "serp",
  "security-headers-generator": "headers",
};

/* The dashboard's Free tools section: every tool as a card (the ones that fix this scan's findings first,
   then by category). A card opens the tool right here, pre-filled from this scan, with a way back to the grid.
   The open tool is kept in the address (?tool=<slug>). */
export function DashTools({ ctx }: { ctx: ToolContext }) {
  const asked = useSearchParams().get("tool");
  const [open, setOpen] = useState<ToolSlug | null>(asked && TOOLS_BY_SLUG.has(asked as ToolSlug) ? (asked as ToolSlug) : null);

  const fixesFor = (slug: ToolSlug): string[] => {
    const k = FIXES_BY_TOOL[slug];
    const list = k ? ctx.fixes[k] : [];
    // The AI bot checker answers the "robots.txt blocks AI crawlers" finding too.
    if (slug === "ai-bot-checker" && ctx.blocked.length) return [`robots.txt blocks ${ctx.blocked.join(", ")}`];
    return list;
  };

  const go = (slug: ToolSlug | null) => {
    setOpen(slug);
    const u = new URL(window.location.href);
    if (slug) u.searchParams.set("tool", slug);
    else u.searchParams.delete("tool");
    window.history.replaceState(window.history.state, "", u);
    document.querySelector(".dash-main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (open) {
    const t = TOOLS_BY_SLUG.get(open)!;
    const View = VIEWS[open];
    const fixes = fixesFor(open);
    return (
      <div className={`dtool ${TONE[t.category]}`}>
        <div className="dtool-bar">
          <button type="button" className="dash-btn" onClick={() => go(null)}><span aria-hidden="true">←</span>&nbsp;All tools</button>
          <Link className="dash-btn" href={`/tools/${t.slug}`} target="_blank" rel="noopener">Open full page ↗</Link>
        </div>
        <div className="tshell">
          <div className="tshell-head">
            <span className="tshell-ic"><ToolIcon slug={t.slug} size={20} /></span>
            <b>{t.name}</b>
            <small>{t.kind === "checker" ? "We fetch the site from our server" : "Runs in your browser"}</small>
          </div>
          <div className="tshell-body">
            <div className="tools">
              <p className="tblurb">{t.lead}</p>
              <p className="tctx" role="status">Pre-filled from your scan of <b>{ctx.host}</b>. Check everything before you publish it.</p>
              {fixes.length > 0 && <p className="tfixes">Fixes from this scan: {fixes.join(" · ")}</p>}
              <View key={open} ctx={ctx} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fixing = TOOL_LIST.filter((t) => fixesFor(t.slug).length > 0).sort((a, b) => fixesFor(b.slug).length - fixesFor(a.slug).length);
  return (
    <div className="dtools">
      {fixing.length > 0 && (
        <section className="dtools-group dtools-fix" aria-labelledby="dt-fix">
          <h3 id="dt-fix"><span className="dtools-dot" aria-hidden="true" />Fix what this scan found</h3>
          <ul>{fixing.map((t, i) => <Card key={t.slug} t={t} i={i} fixes={fixesFor(t.slug)} onOpen={go} />)}</ul>
        </section>
      )}
      {CATEGORIES.map((c) => {
        const list = TOOL_LIST.filter((t) => t.category === c.name);
        if (!list.length) return null;
        const id = `dt-${TONE[c.name]}`;
        return (
          <section key={c.name} className={`dtools-group ${TONE[c.name]}`} aria-labelledby={id}>
            <h3 id={id}>{c.name}<small>{c.text}</small></h3>
            <ul>{list.map((t, i) => <Card key={t.slug} t={t} i={i} fixes={fixesFor(t.slug)} onOpen={go} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}

function Card({ t, i, fixes, onOpen }: { t: ToolInfo; i: number; fixes: string[]; onOpen: (s: ToolSlug) => void }) {
  return (
    <li style={{ ["--i" as string]: i }}>
      <button type="button" className={`dt-card ${TONE[t.category]}`} onClick={() => onOpen(t.slug)} title={fixes.length ? `Fixes: ${fixes.join("; ")}` : undefined}>
        <span className="dt-top">
          <span className="dt-ic"><ToolIcon slug={t.slug} size={20} /></span>
          {fixes.length > 0 ? <span className="dt-fix">Fixes {fixes.length}</span> : t.paid ? <span className="dt-paid">Paid</span> : <span className="dt-kind">{t.kind === "checker" ? "Checker" : "Generator"}</span>}
        </span>
        <b>{t.name}</b>
        <span className="dt-txt">{t.blurb}</span>
        <span className="dt-go">Open tool <span aria-hidden="true">→</span></span>
      </button>
    </li>
  );
}
