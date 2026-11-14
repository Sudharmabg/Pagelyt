"use client";

/* Homepage conversion sections: rotating headline, product-fact stats, the drawn three-step process,
   the comparison table, the tools grid, the example outcome cards, the FAQ and the sticky phone CTA.
   Motion is CSS-first and every piece settles to a static, readable state under reduced motion. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "./arrow";
import { RailNav } from "./rail-nav";
import { COMPARE, COMPARE_COLS, PROCESS, ROTATOR, STATS, STORIES, type Mark } from "./home-data";
import { CATEGORIES, TOOL_LIST, type ToolCategory } from "./tools/catalog";
import { TONE } from "./tools/icons";
import { ToolCard } from "./tools/tool-card";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- hero headline: the full keyword list is real text for search engines and screen readers;
   the rotating words are drawn with CSS content, so the H1's text stays one clean sentence ---------- */
export function HeroTitle() {
  return (
    <h1 id="h1" className="h1-rot" data-r>
      Free website audit for{" "}
      <span className="sr-only">{ROTATOR.slice(0, -1).join(", ")} and {ROTATOR[ROTATOR.length - 1]}</span>
      <span className="rot" aria-hidden="true" style={{ ["--n" as string]: ROTATOR.length }}>
        {ROTATOR.map((w, i) => (
          <span key={w} data-w={w} style={{ ["--i" as string]: i, ["--len" as string]: w.length }} />
        ))}
      </span>
    </h1>
  );
}

/* ---------- stats: final numbers are in the HTML; they count up once when scrolled into view ---------- */
function CountUp({ n, prefix = "", suffix = "" }: { n: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(n);
  useEffect(() => {
    const el = ref.current;
    if (!el || n < 2 || reduced()) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 900);
        setV(Math.round(n * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      setV(0);
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [n]);
  return (
    <span ref={ref}>
      {prefix}
      {v}
      {suffix}
    </span>
  );
}

/* one small line icon per stat: areas, tools, URL, price */
const STAT_ICONS = [
  <g key="areas"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" /></g>,
  <path key="tools" d="M14.7 6.3a4 4 0 0 0-5.2 5.2L4 17l3 3 5.5-5.5a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.6-.8-.8-2.6z" />,
  <g key="url"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></g>,
  <path key="google" d="M5 20V10h3v10H5zm5.5 0V4h3v16h-3zM16 20v-7h3v7h-3z" />,
];

export function StatsBar() {
  return (
    <ul className="stats-bar" aria-label="Pagelyt at a glance">
      {STATS.map((s, i) => (
        <li key={s.label} style={{ ["--i" as string]: i }}>
          <svg className="st-ic" viewBox="0 0 24 24" aria-hidden="true">
            {STAT_ICONS[i]}
          </svg>
          <strong>
            <CountUp n={s.n} prefix={s.prefix} suffix={s.suffix} />
          </strong>
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* the small product preview at the top of each step card (decorative) */
function StepVisual({ i }: { i: number }) {
  if (i === 0)
    return (
      <div className="pv pv-url">
        <span className="pv-bar">
          <span className="pv-type">yourwebsite.com</span>
          <span className="pv-caret" />
        </span>
        <span className="pv-go">Go</span>
      </div>
    );
  if (i === 1)
    return (
      <div className="pv pv-score">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" pathLength={100} />
          <circle className="pv-arc" cx="50" cy="50" r="42" pathLength={100} />
        </svg>
        <strong>
          <CountUp n={82} />
        </strong>
        <span>Overall score</span>
      </div>
    );
  return (
    <ul className="pv pv-fix">
      {[
        ["High", "Compress the hero image"],
        ["Med", "Add meta descriptions"],
        ["Low", "Add alt text to 3 images"],
      ].map(([lvl, t], k) => (
        <li key={t} className={`lv-${lvl.toLowerCase()}`} style={{ ["--k" as string]: k }}>
          <b>{lvl}</b>
          {t}
        </li>
      ))}
    </ul>
  );
}

/* ---------- a timeline: a straight line draws across and each step card pops in as the line reaches it (the parent's data-r adds .in) ---------- */
export function ProcessDraw() {
  return (
    <div className="pdraw" data-r>
      <span className="pd-line" aria-hidden="true" />
      <ol>
        {PROCESS.map((s, i) => (
          <li key={s.h} style={{ ["--i" as string]: i }}>
            <span className="pd-dot" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="pd-card">
              <div aria-hidden="true">
                <StepVisual i={i} />
              </div>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- us vs them: a real table on desktop, one card per row on phones. The Pagelyt column is a raised
   purple card with a ribbon on top and a call to action at the bottom; rows reveal one by one (the parent's
   data-r adds .in). ---------- */
const MARK_LABEL: Record<Mark, string> = { yes: "Strong", part: "Partial", no: "Weak" };

export function Compare({ onGo }: { onGo: () => void }) {
  const rail = useRef<HTMLUListElement>(null);
  return (
    <div className="vs-wrap" data-r>
      <table className="vs">
        <caption className="sr-only">Pagelyt compared with typical SEO tools and a manual agency audit</caption>
        <thead>
          <tr>
            <td />
            {COMPARE_COLS.map((c, i) => (
              <th key={c} scope="col" className={i === 0 ? "us" : undefined}>
                {i === 0 && <span className="vs-rib">Best for owners</span>}
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE.map((r, k) => (
            <tr key={r.row} style={{ ["--r" as string]: k }}>
              <th scope="row">{r.row}</th>
              {r.cells.map(([m, t], i) => (
                <td key={i} data-l={COMPARE_COLS[i]} className={i === 0 ? "us" : undefined}>
                  <span className={`vs-mark ${m}`} role="img" aria-label={MARK_LABEL[m]} />
                  <span className="vs-t">{t}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="vs-foot-tx">See your own report in minutes.</td>
            <td className="us">
              <button type="button" className="btn vs-go" onClick={onGo}>
                Try it free <Arrow />
              </button>
            </td>
            <td />
            <td />
          </tr>
        </tfoot>
      </table>

      {/* phones: one swipeable card per option instead of the table (only one of the two is ever displayed) */}
      <ul className="vs-cards" ref={rail}>
        {COMPARE_COLS.map((c, i) => (
          <li key={c} className={i === 0 ? "us" : undefined}>
            {i === 0 && <span className="vs-rib">Best for owners</span>}
            <b className="vs-cname">{c}</b>
            <ul>
              {COMPARE.map((r) => {
                const [m, t] = r.cells[i];
                return (
                  <li key={r.row}>
                    <span className={`vs-mark ${m}`} role="img" aria-label={MARK_LABEL[m]} />
                    <span>
                      <small>{r.row}</small>
                      {t}
                    </span>
                  </li>
                );
              })}
            </ul>
            {i === 0 && (
              <button type="button" className="btn vs-go" onClick={onGo}>
                Try it free <Arrow />
              </button>
            )}
          </li>
        ))}
      </ul>
      <RailNav rail={rail} count={COMPARE_COLS.length} label="Choose a comparison card" />
    </div>
  );
}

/* ---------- free tools: every tool as a card with an example result, filterable by category.
   Hovering (or focusing) a card replays its example. ---------- */
export function ToolGrid() {
  const [cat, setCat] = useState<ToolCategory | "All">("All");
  const cats = CATEGORIES.filter((c) => TOOL_LIST.some((t) => t.category === c.name));
  const shown = cat === "All" ? TOOL_LIST : TOOL_LIST.filter((t) => t.category === cat);
  const rail = useRef<HTMLUListElement>(null);
  return (
    <>
      <div className="tf-chips" data-r role="group" aria-label="Filter tools by category">
        {(["All", ...cats.map((c) => c.name)] as const).map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} className={c === "All" ? "" : TONE[c]} onClick={() => setCat(c)}>
            {c === "All" ? `All tools (${TOOL_LIST.length})` : c}
          </button>
        ))}
      </div>

      <div className="tf-wrap">
        <ul className="tf-feat" key={cat} ref={rail}>
          {shown.map((t, i) => (
            <li key={t.slug} style={{ ["--i" as string]: i }}>
              <ToolCard t={t} />
            </li>
          ))}
        </ul>
        <RailNav key={`nav-${cat}`} rail={rail} count={shown.length} label="Choose a tool card" />
      </div>
      <div className="btn-row hl-tools-cta">
        <Link className="btn" href="/tools">
          Browse the tools directory <Arrow />
        </Link>
        <Link className="btn ghost" href="/fix">
          Step-by-step fix guides <Arrow />
        </Link>
      </div>
    </>
  );
}

/* ---------- example outcomes: before and after bars grow in and the "after" score counts up when the cards
   scroll into view (the parent's data-r adds .in). Illustrative cases, not customers. ---------- */
const STORY_ICONS = [
  <path key="tooth" d="M7 4c-2 0-3.5 1.6-3.5 4 0 2.6 1.4 4 2 6.5.6 2.6.8 5.5 2.2 5.5 1.6 0 1.4-4.5 4.3-4.5s2.7 4.5 4.3 4.5c1.4 0 1.6-2.9 2.2-5.5.6-2.5 2-3.9 2-6.5 0-2.4-1.5-4-3.5-4-2 0-3 1.2-5 1.2S9 4 7 4z" />,
  <g key="cart"><path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></g>,
  <g key="brief"><rect x="3.5" y="7" width="17" height="12" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></g>,
];

export function Stories() {
  const rail = useRef<HTMLUListElement>(null);
  return (
    <>
    <ul className="story-row" data-r ref={rail}>
      {STORIES.map((s, i) => (
        <li key={s.who} className={`story st-${i}`} style={{ ["--i" as string]: i }}>
          <div className="story-top">
            <span className="story-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24">{STORY_ICONS[i]}</svg>
            </span>
            <b>{s.who}</b>
          </div>
          <p className="story-metric">{s.metric}</p>
          <div className="story-bars" role="img" aria-label={`${s.metric} from ${s.before} to ${s.after} out of 100`}>
            <span className="sb sb-before" style={{ ["--v" as string]: s.before }}>
              <small>Before</small>
              <i />
              <b>{s.before}</b>
            </span>
            <span className="sb sb-after" style={{ ["--v" as string]: s.after }}>
              <small>After</small>
              <i />
              <b>
                <CountUp n={s.after} />
              </b>
            </span>
          </div>
          <p className="story-gain">+{s.after - s.before} points</p>
          <div className="story-found">
            <small>The report found</small>
            <ul>
              {s.found.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <p className="story-time">
            Fixed in <b>{s.time.toLowerCase()}</b>
          </p>
        </li>
      ))}
    </ul>
    <RailNav rail={rail} count={STORIES.length} label="Choose an example" />
    </>
  );
}

/* ---------- phones: a bottom CTA once the hero form scrolls away ---------- */
export function StickyCta({ onGo }: { onGo: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero-url");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`sticky-cta${show ? " on" : ""}`} aria-hidden={!show}>
      <span>Free audit in minutes</span>
      <button className="btn" type="button" onClick={onGo} tabIndex={show ? 0 : -1}>
        Analyse my website <Arrow />
      </button>
    </div>
  );
}
