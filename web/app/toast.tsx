"use client";

import { useEffect, useRef, useState } from "react";

/* A small stacking toast, mounted once in the root layout (`Toaster`). Anything can raise one with
   `toast("Copied")` or `toast("Marked as fixed", { action: { label: "Undo", onClick } })`. Up to three show at
   once, newest in front; each leaves after a few seconds (paused while hovered or focused). Announced politely
   to screen readers. */

type Tone = "ok" | "info" | "err";
type Action = { label: string; onClick: () => void };
type Item = { id: number; text: string; tone: Tone; action?: Action; leaving?: boolean };
type Opts = { tone?: Tone; action?: Action; ms?: number };

const EVENT = "pagelyt:toast";
let next = 1;

export function toast(text: string, opts: Opts = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, ...opts } }));
}

const MAX = 3;

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const timers = useRef(new Map<number, number>());
  const hover = useRef(false);

  useEffect(() => {
    const t = timers.current;
    const leave = (id: number) => {
      setItems((l) => l.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      window.setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 260);
    };
    const arm = (id: number, ms: number) => {
      window.clearTimeout(t.get(id));
      t.set(
        id,
        window.setTimeout(function tick() {
          if (hover.current) return void t.set(id, window.setTimeout(tick, 800));
          leave(id);
        }, ms)
      );
    };
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; tone?: Tone; action?: Action; ms?: number }>).detail;
      const id = next++;
      setItems((l) => [...l.filter((x) => !x.leaving), { id, text: d.text, tone: d.tone ?? "ok", action: d.action }].slice(-MAX));
      arm(id, d.ms ?? (d.action ? 6000 : 3200));
    };
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener(EVENT, on);
      t.forEach((x) => window.clearTimeout(x));
    };
  }, []);

  const close = (id: number) => {
    setItems((l) => l.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    window.setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), 260);
  };

  return (
    <ol
      className="toasts"
      aria-live="polite"
      aria-label="Notifications"
      onPointerEnter={() => (hover.current = true)}
      onPointerLeave={() => (hover.current = false)}
      onFocus={() => (hover.current = true)}
      onBlur={() => (hover.current = false)}
    >
      {items.map((x, i) => (
        <li key={x.id} className={`toast t-${x.tone}${x.leaving ? " out" : ""}`} style={{ ["--n" as string]: items.length - 1 - i }}>
          <span className="toast-ic" aria-hidden="true">
            {x.tone === "err" ? "!" : x.tone === "info" ? "i" : "✓"}
          </span>
          <span className="toast-tx">{x.text}</span>
          {x.action && (
            <button
              type="button"
              className="toast-act"
              onClick={() => {
                x.action?.onClick();
                close(x.id);
              }}
            >
              {x.action.label}
            </button>
          )}
          <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => close(x.id)}>
            ×
          </button>
        </li>
      ))}
    </ol>
  );
}
