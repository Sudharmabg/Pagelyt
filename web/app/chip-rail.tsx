"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** A horizontal row of filter chips that scrolls both ways: arrow buttons and edge fades appear on whichever side has more,
    a mouse wheel scrolls it sideways, a mouse can drag it, and touch swipes natively. The pressed chip is kept in view.
    Used by the /tools and /fix directories. */
export function ChipRail({ label, children, active }: { label: string; children: ReactNode; active?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdge({ left: el.scrollLeft > 2, right: el.scrollLeft < max - 2 });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });

    // a vertical wheel scrolls the rail sideways, but only while it can still move that way (otherwise the page scrolls)
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || el.scrollWidth <= el.clientWidth) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    // drag with a mouse; a real drag swallows the click so it does not also pick a chip
    let startX = 0, startLeft = 0, dragging = false, moved = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      dragging = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) { moved = true; el.classList.add("dragging"); }
      if (moved) el.scrollLeft = startLeft - dx;
    };
    const up = () => { dragging = false; el.classList.remove("dragging"); };
    const click = (e: MouseEvent) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("click", click, true);

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("click", click, true);
    };
  }, []);

  // keep the pressed chip visible, e.g. when ?area= preselects one at the far end
  useEffect(() => {
    const el = ref.current;
    const on = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !on) return;
    const l = on.offsetLeft - el.offsetLeft, r = l + on.offsetWidth;
    if (l < el.scrollLeft || r > el.scrollLeft + el.clientWidth) el.scrollTo({ left: l - el.clientWidth / 2 + on.offsetWidth / 2, behavior: "smooth" });
  }, [active]);

  const nudge = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div className={`chip-rail${edge.left ? " at-l" : ""}${edge.right ? " at-r" : ""}`}>
      <button type="button" className="chip-rail-btn l" onClick={() => nudge(-1)} aria-label="Scroll filters left" tabIndex={-1} hidden={!edge.left}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div ref={ref} className="tb-chips" role="group" aria-label={label}>
        {children}
      </div>
      <button type="button" className="chip-rail-btn r" onClick={() => nudge(1)} aria-label="Scroll filters right" tabIndex={-1} hidden={!edge.right}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  );
}
