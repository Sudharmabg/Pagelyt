"use client";

/* Homepage motion pieces: the drifting collage of report tiles behind the hero, and the "Inside every report"
   bento of small live demos. Everything here is decorative or illustrative sample data; it all settles to a
   still, readable state under reduced motion. */

import { useEffect, useRef, useState } from "react";
import { RollNum } from "./roll-num";

/* ---------- hero collage: two columns of mini report tiles on each side, drifting up or down forever ---------- */
function Tile({ k }: { k: number }) {
  switch (k % 6) {
    case 0:
      return (
        <div className="hc-tile hc-ring" style={{ ["--s" as string]: 82 }}>
          <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" pathLength={100} /><circle cx="20" cy="20" r="16" pathLength={100} /></svg>
          <b>82</b>
          <small>Overall</small>
        </div>
      );
    case 1:
      return (
        <div className="hc-tile hc-bars">
          <small>Core Web Vitals</small>
          {[78, 54, 91].map((v, i) => <i key={i} style={{ ["--v" as string]: v }} />)}
        </div>
      );
    case 2:
      return (
        <div className="hc-tile hc-rows">
          <small>Top fixes</small>
          <span className="lv-high">Compress hero image</span>
          <span className="lv-med">Add meta description</span>
        </div>
      );
    case 3:
      return (
        <div className="hc-tile hc-chip">
          <span>✓</span>
          <small>Cited by ChatGPT</small>
        </div>
      );
    case 4:
      return (
        <div className="hc-tile hc-spark">
          <small>Clicks · 28 days</small>
          <svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 24 L14 20 L28 22 L42 14 L56 16 L70 9 L84 11 L100 4" /></svg>
        </div>
      );
    default:
      return (
        <div className="hc-tile hc-ring hc-ring-ok" style={{ ["--s" as string]: 96 }}>
          <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" pathLength={100} /><circle cx="20" cy="20" r="16" pathLength={100} /></svg>
          <b>96</b>
          <small>Security</small>
        </div>
      );
  }
}

const COLS = [
  [0, 2, 4, 1],
  [3, 5, 1, 2],
  [1, 4, 0, 3],
  [5, 2, 3, 0],
];

export function HeroCollage() {
  return (
    <div className="hero-collage" aria-hidden="true">
      {COLS.map((col, c) => (
        <div key={c} className={`hc-col hc-c${c}`}>
          {/* the column is drawn twice so the loop is seamless */}
          <div className="hc-track">
            {[...col, ...col].map((k, i) => <Tile key={i} k={k} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- "Inside every report": a bento of small live demos ---------- */
const AREAS: [string, number][] = [
  ["Health", 88],
  ["Speed", 61],
  ["SEO", 74],
  ["AI search", 69],
  ["Security", 96],
  ["Access", 83],
];

function BentoHead({ title, tag, icon }: { title: string; tag: string; icon: React.ReactNode }) {
  return (
    <header className="bt-head">
      <span className="bt-ic" aria-hidden="true">
        <svg viewBox="0 0 24 24">{icon}</svg>
      </span>
      <h3>{title}</h3>
      <span className="bt-tag">{tag}</span>
    </header>
  );
}

const ISSUES = [
  { lvl: "High", t: "Hero image is 2.4 MB", p: "/" },
  { lvl: "Med", t: "Missing meta description", p: "/pricing" },
  { lvl: "Med", t: "No llms.txt for AI assistants", p: "/" },
  { lvl: "Low", t: "3 images without alt text", p: "/blog" },
];

function FixStack() {
  const [top, setTop] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const left = ISSUES.length - top;
  const fix = () => {
    if (leaving) return;
    if (left === 0) {
      setTop(0);
      return;
    }
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      setTop((t) => t + 1);
    }, 380);
  };
  return (
    <div className="bt-stack">
      <ol className="bs-cards">
        {ISSUES.map((it, i) => {
          const d = i - top;
          if (d < 0 || d > 2) return null;
          return (
            <li key={it.t} className={`bs-card lv-${it.lvl.toLowerCase()}${d === 0 && leaving ? " out" : ""}`} style={{ ["--d" as string]: d }} aria-hidden={d !== 0}>
              <b>{it.lvl}</b>
              <span>{it.t}</span>
              <small>{it.p}</small>
            </li>
          );
        })}
        {left === 0 && (
          <li className="bs-done">
            <span aria-hidden="true">✓</span> All fixed. Rescan to confirm.
          </li>
        )}
      </ol>
      <div className="bs-foot">
        <span aria-live="polite">{left === 0 ? "0 left" : `${left} to fix`}</span>
        <button type="button" className="bs-btn" onClick={fix}>
          {left === 0 ? "Start again" : "Mark fixed"}
        </button>
      </div>
    </div>
  );
}

const ANSWER = "For a family dentist in Pune, people often recommend Bright Smile Dental (yoursite.com): clear prices, Sunday hours and great reviews.";

function TypedAnswer() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [n, setN] = useState(ANSWER.length);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let visible = false;
    const run = (i: number) => {
      setN(i);
      if (!visible) return;
      timer = window.setTimeout(() => run(i >= ANSWER.length ? 0 : i + 1), i >= ANSWER.length ? 3200 : i === 0 ? 500 : 28);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      window.clearTimeout(timer);
      if (visible) run(0);
      else setN(ANSWER.length);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, []);
  const shown = ANSWER.slice(0, n);
  const brand = "Bright Smile Dental (yoursite.com)";
  const at = ANSWER.indexOf(brand);
  return (
    <div className="bt-chat">
      <p className="bc-q">Best family dentist in Pune?</p>
      <p className="bc-a" ref={ref}>
        <span className="sr-only">{ANSWER}</span>
        <span aria-hidden="true">
          {shown.slice(0, at)}
          {n > at && <mark>{shown.slice(at, at + brand.length)}</mark>}
          {n > at + brand.length && shown.slice(at + brand.length)}
          {n < ANSWER.length && <i className="bc-caret" />}
        </span>
      </p>
      <p className="bc-cite">
        <span aria-hidden="true">✓</span> Your site is named and cited
      </p>
    </div>
  );
}

export function ReportBento() {
  return (
    <ul className="bento" aria-label="What a report looks like">
      <li className="bt bt-score">
        <BentoHead title="Your score" tag="Counts up" icon={<g><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /></g>} />
        <div className="bt-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" pathLength={100} />
            <circle className="bt-arc" cx="50" cy="50" r="42" pathLength={100} />
          </svg>
          <strong>
            <RollNum n={78} />
          </strong>
          <span>out of 100</span>
        </div>
        <ul className="bt-areas">
          {AREAS.map(([a, v], i) => (
            <li key={a} style={{ ["--v" as string]: v, ["--i" as string]: i }} className={v >= 80 ? "ok" : v >= 65 ? "mid" : "low"}>
              <span>{a}</span>
              <i aria-hidden="true" />
              <b>{v}</b>
            </li>
          ))}
        </ul>
        <p className="bt-note">Eight areas, one number, updated on every scan.</p>
      </li>

      <li className="bt bt-folder" tabIndex={0}>
        <BentoHead title="Every page checked" tag="Fan on hover" icon={<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />} />
        <div className="bf-art" aria-hidden="true">
          <span className="bf-back" />
          {[
            ["/pricing", "2 issues"],
            ["/blog/guide", "4 issues"],
            ["/", "1 issue"],
          ].map(([p, n], i) => (
            <span key={p} className="bf-sheet" style={{ ["--i" as string]: i }}>
              <b>{p}</b>
              <small>{n}</small>
              <i />
              <i />
            </span>
          ))}
          <span className="bf-front">
            <b>37 pages</b>
            <small>crawled and checked</small>
          </span>
        </div>
      </li>

      <li className="bt bt-fix">
        <BentoHead title="Fixes, ranked" tag="Click to fix" icon={<path d="M5 12.5l4.2 4.2L19 7" />} />
        <FixStack />
      </li>

      <li className="bt bt-vitals">
        <BentoHead title="Speed you can feel" tag="Live" icon={<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />} />
        <ul className="bv">
          {[
            ["LCP", "2.1 s", 70, "ok"],
            ["INP", "260 ms", 52, "mid"],
            ["CLS", "0.04", 88, "ok"],
          ].map(([k, v, w, t], i) => (
            <li key={k as string} className={t as string} style={{ ["--w" as string]: w, ["--i" as string]: i }}>
              <b>{k}</b>
              <span className="bv-track" aria-hidden="true"><i /></span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
        <p className="bt-note">Real Core Web Vitals for phones, with what slows each one down.</p>
      </li>

      <li className="bt bt-ai">
        <BentoHead title="Seen by AI search" tag="Typed live" icon={<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />} />
        <TypedAnswer />
      </li>
    </ul>
  );
}
