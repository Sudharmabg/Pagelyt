"use client";

import { useEffect } from "react";

/* One tooltip for the whole site, mounted in the root layout. Any element with `data-tip="…"` shows it on
   hover (after a short pause) and on keyboard focus, placed above the element (below when there's no room)
   and kept inside the screen. It lives on <body> with position: fixed, so no card or scroll box can clip it.
   On focus the element is linked to it with aria-describedby. Escape hides it. */
export function TooltipHost() {
  useEffect(() => {
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.id = "pagelyt-tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
    let cur: HTMLElement | null = null;
    let timer = 0;

    const place = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      const below = r.top - t.height - 10 < 8;
      const x = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
      const y = below ? r.bottom + 10 : r.top - t.height - 10;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      tip.style.setProperty("--ax", `${r.left + r.width / 2 - x}px`);
      tip.dataset.side = below ? "below" : "above";
    };
    const show = (el: HTMLElement, wait: number) => {
      const text = el.dataset.tip;
      if (!text) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        cur = el;
        tip.textContent = text;
        tip.classList.add("on");
        place(el);
        el.setAttribute("aria-describedby", tip.id);
      }, wait);
    };
    const hide = () => {
      window.clearTimeout(timer);
      tip.classList.remove("on");
      if (cur?.getAttribute("aria-describedby") === tip.id) cur.removeAttribute("aria-describedby");
      cur = null;
    };
    const target = (e: Event) => (e.target instanceof Element ? (e.target.closest("[data-tip]") as HTMLElement | null) : null);

    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = target(e);
      if (el && el !== cur) show(el, 280);
      else if (!el) hide();
    };
    const focus = (e: FocusEvent) => {
      const el = target(e);
      if (el && (e.target as Element).matches(":focus-visible")) show(el, 0);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && hide();

    document.addEventListener("pointerover", over);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", hide, { capture: true });
      tip.remove();
    };
  }, []);
  return null;
}
