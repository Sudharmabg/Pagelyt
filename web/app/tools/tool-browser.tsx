"use client";

import { useMemo, useState } from "react";
import type { ToolCategory, ToolInfo } from "./catalog";
import { TONE, ToolIcon } from "./icons";
import { ToolCard } from "./tool-card";
import { ChipRail } from "../chip-rail";

type Card = Pick<ToolInfo, "slug" | "name" | "blurb" | "category" | "kind" | "paid">;

/* The /tools directory: a big search box, sticky category chips, then each category's tool cards. Every card is in the server HTML;
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
      <label className="tb-search">
        <span className="sr-only">Search the tools</span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" placeholder="Search tools, e.g. robots, schema, AI" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <button type="button" className="tb-clear" onClick={() => setQ("")} aria-label="Clear search">
            ×
          </button>
        )}
      </label>
      <div className="tb-bar">
        <ChipRail label="Filter by category" active={cat}>
          {(["All", ...categories.map((c) => c.name)] as const).map((c) => (
            <button key={c} type="button" className={`tb-chip${c === "All" ? "" : ` ${TONE[c]}`}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c === "All" ? "All tools" : c}
              <small>{c === "All" ? tools.length : tools.filter((t) => t.category === c).length}</small>
            </button>
          ))}
        </ChipRail>
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
        const n = list.filter((t) => shown.has(t.slug)).length;
        if (!n) return null;
        return (
          <section key={c.name} className={`tb-group ${TONE[c.name]}`} aria-labelledby={`cat-${i}`}>
            <div className="tb-head">
              <span className="tb-head-ic" aria-hidden="true">
                <ToolIcon slug={list[0].slug} size={22} />
              </span>
              <span className="tb-head-tx">
                <h2 id={`cat-${i}`}>{c.name}</h2>
                <p>{c.text}</p>
              </span>
              <span className="tb-count">{n} {n === 1 ? "tool" : "tools"}</span>
            </div>
            <ul className="tf-feat tb-grid" key={`${cat}|${query}`}>
              {list.map((t, k) => (
                <li key={t.slug} hidden={!shown.has(t.slug)} style={{ ["--i" as string]: k }}>
                  <ToolCard t={t} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
