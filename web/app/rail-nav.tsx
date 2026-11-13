"use client";

import { useEffect, useState, type RefObject } from "react";

/** Dots and previous / next arrows under a row of cards that swipes sideways (one card per swipe on phones).
    Shows only while the row actually overflows, so on wide screens, where the cards sit in a grid, it renders nothing.
    The row itself keeps native touch scrolling and scroll snapping; this only follows it and moves it. */
export function RailNav({ rail, count, label }: { rail: RefObject<HTMLElement | null>; count: number; label: string }) {
  const [on, setOn] = useState(false);
  const [at, setAt] = useState(0);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const measure = () => {
      setOn(el.scrollWidth > el.clientWidth + 4);
      const first = el.children[0] as HTMLElement | undefined;
      const step = first ? first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0") : el.clientWidth;
      setAt(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / Math.max(1, step)))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [rail, count]);

  const go = (i: number) => {
    const el = rail.current;
    const card = el?.children[Math.max(0, Math.min(count - 1, i))] as HTMLElement | undefined;
    if (!el || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const left = el.scrollLeft + card.getBoundingClientRect().left - el.getBoundingClientRect().left - parseFloat(getComputedStyle(el).paddingLeft || "0");
    el.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
  };

  if (!on || count < 2) return null;
  return (
    <div className="rail-nav" role="group" aria-label={label}>
      <button type="button" className="rail-arr" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous card">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <span className="rail-dots">
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" className={i === at ? "on" : undefined} onClick={() => go(i)} aria-label={`Card ${i + 1} of ${count}`} aria-current={i === at ? "true" : undefined} />
        ))}
      </span>
      <button type="button" className="rail-arr" onClick={() => go(at + 1)} disabled={at === count - 1} aria-label="Next card">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}
