"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Arrow } from "../arrow";
import type { ToolCategory, ToolInfo } from "./catalog";
import { TONE, ToolIcon } from "./icons";

type Card = Pick<ToolInfo, "slug" | "name" | "blurb" | "category" | "kind">;

/* The /tools directory: a search box and category chips over the tool cards. Every card is in the server HTML;
   filtering only hides them, so search engines and no-JS visitors still see the full list. */
export function ToolBrowser({ tools, categories }: { tools: Card[]; categories: { name: ToolCategory; text: string }[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ToolCategory | "All">("All");
  const query = q.trim().toLowerCase();
  const shown = useMemo(
    () => new Set(tools.filter((t) => (cat === "All" || t.category === cat) && (!query || `${t.name} ${t.blurb} ${t.category}`.toLowerCase().includes(query))).map((t) => t.slug)),
    [tools, cat, query]
  );

  return (
    <div className="tb">
      <div className="tb-bar">
        <label className="tb-search">
          <span className="sr-only">Search the tools</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input type="search" placeholder="Search tools, e.g. robots, schema, AI" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="tb-chips" role="group" aria-label="Filter by category">
          {(["All", ...categories.map((c) => c.name)] as const).map((c) => (
            <button key={c} type="button" className={`tb-chip${c === "All" ? "" : ` ${TONE[c]}`}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
              <small>{c === "All" ? tools.length : tools.filter((t) => t.category === c).length}</small>
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" role="status">{shown.size} tools shown</p>
      {shown.size === 0 && (
        <p className="tb-empty">
          No tool matches &ldquo;{q}&rdquo;.{" "}
          <button type="button" onClick={() => { setQ(""); setCat("All"); }}>Show all tools</button>
        </p>
      )}

      {categories.map((c, i) => {
        const list = tools.filter((t) => t.category === c.name);
        if (!list.some((t) => shown.has(t.slug))) return null;
        return (
          <section key={c.name} className="tb-group" aria-labelledby={`cat-${i}`}>
            <div className="tb-head">
              <h2 id={`cat-${i}`}><span className={`tb-dot ${TONE[c.name]}`} aria-hidden="true" />{c.name}</h2>
              <p>{c.text}</p>
            </div>
            <ul className="tgrid2">
              {list.map((t) => (
                <li key={t.slug} hidden={!shown.has(t.slug)}>
                  <Link href={`/tools/${t.slug}`} className={`tcard ${TONE[t.category]}`}>
                    <span className="tcard-ic"><ToolIcon slug={t.slug} /></span>
                    <span className="tcard-kind">{t.kind === "checker" ? "Checker" : "Generator"}</span>
                    <b>{t.name}</b>
                    <span className="tcard-txt">{t.blurb}</span>
                    <span className="tcard-go">Open tool <Arrow /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
