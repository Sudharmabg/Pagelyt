"use client";

import { useEffect, useRef } from "react";

/* A tool's three steps as a timeline: a straight line draws across and each step pops in as the line reaches it.
   Starts when it scrolls into view; shown at once for reduced motion or without JavaScript (CSS). */
export function ToolSteps({ steps }: { steps: [string, string][] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("armed");
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.classList.add("in");
        io.disconnect();
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <ol className="tline" ref={ref} aria-label="How it works">
      {steps.map(([h, p], i) => (
        <li key={h} style={{ ["--i" as string]: i }}>
          <span className="tline-dot" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <b>{h}</b>
          <span>{p}</span>
        </li>
      ))}
    </ol>
  );
}
