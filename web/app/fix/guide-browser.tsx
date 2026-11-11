"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { ModuleKey } from "@/lib/scan/types";
import { Arrow } from "../arrow";
import { ChipRail } from "../chip-rail";
import { AreaIcon } from "../dashboard/icons";

export type GuideCard = { id: string; title: string; summary: string; module: ModuleKey; steps: number; dev: boolean; tool: boolean };
type Area = { key: ModuleKey; name: string; text: string };

const noop = () => () => {};
const readArea = () => new URLSearchParams(window.location.search).get("area");

/* The /fix directory: search box, area chips, then each area's guide cards. Every card is in the server HTML;
   filtering only hides them, so search engines and no-JS visitors still see the full list.
   ?area=<module> preselects a chip (used by the area tag on each guide page). */
export function GuideBrowser({ guides, areas }: { guides: GuideCard[]; areas: Area[] }) {
  const [q, setQ] = useState("");
  const [picked, setArea] = useState<ModuleKey | "all" | null>(null);
  const fromUrl = useSyncExternalStore(noop, readArea, () => null);
  const area = picked ?? (areas.some((x) => x.key === fromUrl) ? (fromUrl as ModuleKey) : "all");
  const query = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const name = (k: ModuleKey) => areas.find((a) => a.key === k)?.name ?? k;
    return new Set(guides.filter((g) => (area === "all" || g.module === area) && (!query || `${g.title} ${g.summary} ${name(g.module)}`.toLowerCase().includes(query))).map((g) => g.id));
  }, [guides, areas, area, query]);

  return (
    <div className="tb">
      <label className="tb-search">
        <span className="sr-only">Search the fix guides</span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" placeholder="Search guides, e.g. HSTS, sitemap, alt text" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && (
          <button type="button" className="tb-clear" onClick={() => setQ("")} aria-label="Clear search">
            ×
          </button>
        )}
      </label>
      <div className="tb-bar">
        <ChipRail label="Filter by area" active={area}>
          <button type="button" className="tb-chip" aria-pressed={area === "all"} onClick={() => setArea("all")}>
            All guides <small>{guides.length}</small>
          </button>
          {areas.map((a) => (
            <button key={a.key} type="button" className={`tb-chip ga-${a.key}`} aria-pressed={area === a.key} onClick={() => setArea(a.key)}>
              {a.name}
              <small>{guides.filter((g) => g.module === a.key).length}</small>
            </button>
          ))}
        </ChipRail>
      </div>

      <p className="sr-only" role="status">{shown.size} guides shown</p>
      {shown.size === 0 && (
        <p className="tb-empty">
          No guide matches &ldquo;{q}&rdquo;.{" "}
          <button type="button" onClick={() => { setQ(""); setArea("all"); }}>Show all guides</button>
        </p>
      )}

      {areas.map((a) => {
        const list = guides.filter((g) => g.module === a.key);
        const n = list.filter((g) => shown.has(g.id)).length;
        if (!n) return null;
        return (
          <section key={a.key} id={a.key} className={`tb-group ga-${a.key}`} aria-labelledby={`area-${a.key}`}>
            <div className="tb-head">
              <span className="tb-head-ic" aria-hidden="true">
                <AreaIcon k={a.key} size={22} />
              </span>
              <span className="tb-head-tx">
                <h2 id={`area-${a.key}`}>{a.name}</h2>
                <p>{a.text}</p>
              </span>
              <span className="tb-count">{n} {n === 1 ? "guide" : "guides"}</span>
            </div>
            <ul className="gb-grid" key={`${area}|${query}`}>
              {list.map((g, k) => (
                <li key={g.id} hidden={!shown.has(g.id)} style={{ ["--i" as string]: k }}>
                  <Link href={`/fix/${g.id}`} className="gb-card">
                    <b>{g.title}</b>
                    <span className="gb-txt">{g.summary}</span>
                    <span className="gb-meta">
                      <span>{g.steps} steps</span>
                      {g.dev && <span>Code snippet</span>}
                      {g.tool && <span className="gb-tool">Free tool</span>}
                    </span>
                    <span className="gb-go">
                      Read the guide <Arrow />
                    </span>
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
