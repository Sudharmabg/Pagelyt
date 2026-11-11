"use client";

import { useEffect, useRef } from "react";

/* A list that animates in once it scrolls into view: adds .armed on mount (so the hidden state needs JavaScript)
   and .in when it is visible. The CSS for each list decides what the animation is; without JavaScript, or under
   reduced motion, the list is simply shown. */
export function RevealList({ className, label, children }: { className: string; label?: string; children: React.ReactNode }) {
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
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <ol className={className} ref={ref} aria-label={label}>
      {children}
    </ol>
  );
}
