"use client";

import { useEffect } from "react";

/* Site-wide scroll reveal, mounted once in the root layout.
   1. Elements that ask for it with `data-r` get `.in` when they scroll into view (their CSS sets the animation).
   2. Blocks matched by AUTO that start below the fold are tagged `data-rv` and fade and rise in as they arrive;
      a grid list reveals its items one after another instead. Only below-the-fold elements are tagged, so nothing
      that is already on screen ever blinks out. The state lives in `data-rv` (not a class) so React re-renders
      can't undo it; after the animation it is set to "done", which carries no styles at all.
   Nothing is tagged under reduced motion, in print, or for elements that already run their own animation. */
const AUTO = [
  "main .sec .container > *",
  ".dash-main > *",
  ".dash-cards > *",
  ".star-strip > *",
].join(",");

const MAX_STAGGER = 10;

export function RevealHost() {
  useEffect(() => {
    document.documentElement.classList.add("js");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          io.unobserve(el);
          if (el.hasAttribute("data-r")) el.classList.add("in");
          if (el.getAttribute("data-rv") === "") el.setAttribute("data-rv", "in");
        }),
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );

    const done = (e: AnimationEvent) => {
      const el = e.target as HTMLElement;
      if (e.animationName === "rv-in" && el.getAttribute("data-rv") === "in") el.setAttribute("data-rv", "done");
    };
    document.addEventListener("animationend", done);

    const tag = (el: HTMLElement, k: number, fold: number) => {
      if (el.hasAttribute("data-rv") || el.hasAttribute("data-r") || el.closest("[data-r]")) return;
      // Inside a block that is still waiting or animating: the parent's reveal already covers it.
      if (el.parentElement?.closest('[data-rv=""], [data-rv="in"]')) {
        el.setAttribute("data-rv", "done");
        return;
      }
      const cs = getComputedStyle(el);
      const skip =
        cs.display === "none" ||
        cs.position === "fixed" ||
        cs.position === "sticky" ||
        cs.animationName !== "none" ||
        el.getBoundingClientRect().top < fold;
      if (skip) {
        el.setAttribute("data-rv", "done");
        return;
      }
      el.style.setProperty("--rd", String(Math.min(k, MAX_STAGGER)));
      el.setAttribute("data-rv", "");
      io.observe(el);
    };

    const scan = () => {
      // Also picks up anything tagged by an earlier mount (React remounts effects in development).
      document.querySelectorAll<HTMLElement>('[data-r]:not(.in), [data-rv=""]').forEach((el) => io.observe(el));
      if (reduce) return;
      const fold = window.innerHeight;
      document.querySelectorAll<HTMLElement>(AUTO).forEach((el) => {
        if (el.hasAttribute("data-rv")) return;
        const cs = getComputedStyle(el);
        const isGrid = (el.tagName === "UL" || el.tagName === "OL") && (cs.display === "grid" || cs.display === "flex") && el.children.length >= 3;
        if (isGrid) {
          el.setAttribute("data-rv", "done");
          Array.from(el.children).forEach((c, k) => tag(c as HTMLElement, k, fold));
        } else {
          const k = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0;
          tag(el, k % 4, fold);
        }
      });
    };

    scan();
    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("animationend", done);
    };
  }, []);
  return null;
}
