"use client";

import { useEffect, useRef } from "react";

const DIGITS = Array.from({ length: 10 }, (_, d) => <i key={d}>{d}</i>);

/* An odometer number: each digit is a column of 0–9 that rolls to its value once the number scrolls into view,
   the last digit first. The real value is in the HTML (screen readers read the sr-only text), and without
   JavaScript or under reduced motion the digits simply sit at their value. State is a data attribute, not a
   class, so a re-render can't reset it. */
export function RollNum({ n, prefix = "", suffix = "" }: { n: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.setAttribute("data-st", "armed");
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        requestAnimationFrame(() => el.setAttribute("data-st", "in"));
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [n]);
  const digits = String(n).split("");
  return (
    <span className="roll" ref={ref}>
      <span className="sr-only">
        {prefix}
        {n}
        {suffix}
      </span>
      {prefix && <span aria-hidden="true">{prefix}</span>}
      {digits.map((d, i) =>
        /\d/.test(d) ? (
          <span key={i} className="rd" aria-hidden="true" style={{ ["--v" as string]: d, ["--k" as string]: digits.length - 1 - i }}>
            <span>{DIGITS}</span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">{d}</span>
        )
      )}
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </span>
  );
}
