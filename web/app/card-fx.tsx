"use client";

import { useEffect } from "react";

/* Tilt and glow for cards, mounted once in the root layout. While a mouse is over one of the cards in
   SELECTOR, it gets `data-tilt` plus --rx / --ry (a few degrees of tilt towards the pointer) and --mx / --my
   (where the soft glow sits). The CSS ("Tilt and glow cards" in globals.css) does the rest. Mouse and pen only:
   touch screens and reduced motion get the cards' normal hover. */
const SELECTOR = [".dash-cards > li > button", ".tf-card", ".ftile", ".bento > .bt", ".post-feature"].join(",");
const MAX_DEG = 5;

export function CardFx() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cur: HTMLElement | null = null;
    let raf = 0;
    let last: PointerEvent | null = null;

    const reset = () => {
      if (!cur) return;
      cur.removeAttribute("data-tilt");
      cur.style.removeProperty("--rx");
      cur.style.removeProperty("--ry");
      cur = null;
    };
    const paint = () => {
      raf = 0;
      if (!cur || !last) return;
      const r = cur.getBoundingClientRect();
      const px = (last.clientX - r.left) / r.width;
      const py = (last.clientY - r.top) / r.height;
      cur.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      cur.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      cur.style.setProperty("--ry", `${((px - 0.5) * 2 * MAX_DEG).toFixed(2)}deg`);
      cur.style.setProperty("--rx", `${((0.5 - py) * 2 * MAX_DEG).toFixed(2)}deg`);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = e.target instanceof Element ? (e.target.closest(SELECTOR) as HTMLElement | null) : null;
      if (el !== cur) {
        reset();
        if (el) {
          cur = el;
          el.setAttribute("data-tilt", "");
        }
      }
      last = e;
      if (cur && !raf) raf = requestAnimationFrame(paint);
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      cancelAnimationFrame(raf);
      reset();
    };
  }, []);
  return null;
}
