"use client";

import Link from "next/link";
import { Accessibility, Activity, ArrowRight, Bot, CodeXml, Cookie, Gauge, MailCheck, Search, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ElementType, type KeyboardEvent } from "react";
import { FEATURES } from "./features-data";

/* Per area: icon, colour pair, and the sample result shown in the preview card (illustrative, not real data). */
const AREAS: Record<string, { icon: ElementType; c1: string; c2: string; score: number; stat: string; finding: string; tag?: string }> = {
  "website-health": { icon: Activity, c1: "#14a58e", c2: "#5ee0c4", score: 92, stat: "99.98% uptime", finding: "3 redirect chains slow down /blog" },
  performance: { icon: Gauge, c1: "#f08c1a", c2: "#ffc46b", score: 74, stat: "LCP 2.9 s on phones", finding: "Hero image is 2.4 MB: serve WebP" },
  seo: { icon: Search, c1: "#3b82f6", c2: "#8cc1ff", score: 82, stat: "42 pages crawled", finding: "4 pages share the same title" },
  geo: { icon: Bot, c1: "#7c5cf0", c2: "#c3b1ff", score: 68, stat: "4 of 5 AI crawlers allowed", finding: "No FAQ schema on /pricing" },
  security: { icon: ShieldCheck, c1: "#22a35a", c2: "#7ee0a3", score: 61, stat: "4 missing security headers", finding: "/.git/config is publicly readable" },
  accessibility: { icon: Accessibility, c1: "#0e8fd6", c2: "#7cc9f5", score: 87, stat: "4 WCAG rules failing", finding: "12 images have no alt text", tag: "WCAG 1.1.1 · A" },
  "domain-email": { icon: MailCheck, c1: "#d9622b", c2: "#ffad85", score: 70, stat: "Domain renews in 281 days", finding: "DMARC is p=none: spoofed mail gets through" },
  privacy: { icon: Cookie, c1: "#b0861a", c2: "#f1cf6e", score: 79, stat: "3 trackers on the homepage", finding: "Trackers load before cookie consent" },
  "code-security": { icon: CodeXml, c1: "#3f3cbb", c2: "#8fa8ff", score: 86, stat: "4 files read, 4 libraries", finding: "jQuery 3.4.1 has known vulnerabilities", tag: "CVE-2020-11022" },
};

/** One tab per scored area: the feature pages that carry an `area`. */
const LIST = FEATURES.filter((f) => f.area && AREAS[f.slug]);
const TOTAL_CHECKS = LIST.reduce((n, f) => n + f.checks.length, 0);
const STEP_MS = 6000;

/** Homepage "What Pagelyt checks": a dark showcase with one tab per feature (from features-data), its checks and a
 *  sample result. Cycles through the areas while it is on screen, until the visitor picks one. */
export function HomeChecks() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // No auto-cycle for reduced motion, or on phones, where panels of different heights would jump the page.
    if (window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 760px)").matches) setAuto(false);
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !visible) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % LIST.length), STEP_MS);
    return () => window.clearTimeout(t);
  }, [auto, visible, active]);

  // Phone: keep the chosen tab in view inside the sideways-scrolling rail (never scrolls the page).
  useEffect(() => {
    const tab = tabRefs.current[active];
    const rail = tab?.parentElement;
    if (!tab || !rail || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollTo({ left: tab.offsetLeft - rail.offsetLeft - 8, behavior: "smooth" });
  }, [active]);

  const pick = (i: number, focus = false) => {
    setAuto(false);
    setActive(i);
    if (focus) tabRefs.current[i]?.focus({ preventScroll: true });
  };

  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (e.key in keys) {
      e.preventDefault();
      pick((active + keys[e.key] + LIST.length) % LIST.length, true);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      pick(e.key === "Home" ? 0 : LIST.length - 1, true);
    }
  };

  const f = LIST[active];
  const a = AREAS[f.slug];
  const Icon = a.icon;
  const tone = { "--c1": a.c1, "--c2": a.c2 } as CSSProperties;

  return (
    <>
      <ul className="hc-chips" aria-label="At a glance">
        <li><b>{LIST.length}</b> areas</li>
        <li><b>{TOTAL_CHECKS}</b> checks</li>
        <li><b>1</b> clear score</li>
      </ul>

      <div className="hc-show" ref={rootRef} style={tone}>
        <div className="hc-rail" role="tablist" aria-label="What Pagelyt checks" aria-orientation="vertical" onKeyDown={onKey}>
          {LIST.map((t, i) => {
            const TI = AREAS[t.slug].icon;
            const on = i === active;
            return (
              <button
                key={t.slug}
                ref={(el) => { tabRefs.current[i] = el; }}
                role="tab"
                id={`hc-tab-${t.slug}`}
                aria-selected={on}
                aria-controls="hc-panel"
                tabIndex={on ? 0 : -1}
                className={`hc-tab${on ? " on" : ""}`}
                style={{ "--c1": AREAS[t.slug].c1, "--c2": AREAS[t.slug].c2 } as CSSProperties}
                onClick={() => pick(i)}
              >
                <span className="hc-tab-ic" aria-hidden="true"><TI /></span>
                <span className="hc-tab-name">{t.name}</span>
                {on && auto && visible && <i className="hc-prog" key={active} aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className="hc-panel" id="hc-panel" role="tabpanel" aria-labelledby={`hc-tab-${f.slug}`} key={f.slug}>
          <div className="hc-main">
            <h3 className="hc-h"><span className="hc-h-ic" aria-hidden="true"><Icon /></span>{f.name}</h3>
            <p className="hc-lead">{f.lead}</p>
            <ul className="hc-list">
              {f.checks.map((c, i) => (
                <li key={c} style={{ "--i": i } as CSSProperties}>
                  <span aria-hidden="true">✓</span>
                  {c}
                </li>
              ))}
            </ul>
            <Link className="hc-more" href={`/features/${f.slug}`}>
              <span>More on {f.name}</span>
              <span className="hc-more-go" aria-hidden="true"><ArrowRight /></span>
            </Link>
          </div>

          <figure className="hc-viz" aria-label={`Sample ${f.name} result`}>
            <figcaption>Sample result</figcaption>
            <div className="hc-ring" style={{ "--v": a.score } as CSSProperties}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="50" className="hc-ring-bg" />
                <circle cx="60" cy="60" r="50" className="hc-ring-fg" pathLength={100} />
              </svg>
              <span><b>{a.score}</b><small>/ 100</small></span>
            </div>
            <p className="hc-stat">{a.stat}</p>
            <p className="hc-find"><span aria-hidden="true">!</span>{a.finding}</p>
            {a.tag && <p className="hc-tag">{a.tag}</p>}
          </figure>
        </div>
      </div>
    </>
  );
}
