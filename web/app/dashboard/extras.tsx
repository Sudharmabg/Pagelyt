"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AreaIcon } from "./icons";
import type { Finding, ModuleKey } from "@/lib/scan/types";

/* ------------------------------------------------------------------ */
/* Theme (light / dark), remembered in this browser                    */
/* ------------------------------------------------------------------ */

export function useTheme() {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener("pagelyt-theme", cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener("pagelyt-theme", cb);
    };
  }, []);
  const stored = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem("pagelyt-theme") ?? "";
      } catch {
        return "";
      }
    },
    () => ""
  );
  const system = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false
  );
  const dark = stored ? stored === "dark" : system;
  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem("pagelyt-theme", dark ? "light" : "dark");
    } catch {
      /* storage blocked */
    }
    window.dispatchEvent(new Event("pagelyt-theme"));
  }, [dark]);
  return { dark, toggle };
}

export function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="dash-btn icon" onClick={onToggle} aria-pressed={dark} aria-label="Dark mode" title="Dark mode">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
        )}
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Radar: the shape of the site across all areas                        */
/* ------------------------------------------------------------------ */

const SHORT: Record<ModuleKey, string> = { health: "Health", performance: "Speed", seo: "SEO", geo: "AI", security: "Security", accessibility: "Access", domain: "Domain", privacy: "Privacy" };

export function RadarPanel({ modules }: { modules: { key: ModuleKey; name: string; score: number }[] }) {
  const n = modules.length;
  const size = 300, c = size / 2, R = 96;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * R * (v / 100), c + Math.sin(a) * R * (v / 100)] as const;
  };
  const poly = modules.map((m, i) => pt(i, m.score).join(",")).join(" ");
  return (
    <section className="panel" aria-label="Shape of your site">
      <h2>Shape of your site</h2>
      <svg className="radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Radar chart. ${modules.map((m) => `${m.name} ${m.score}`).join(", ")}`}>
        {[25, 50, 75, 100].map((r) => (
          <polygon key={r} className="rd-ring" points={modules.map((_, i) => pt(i, r).join(",")).join(" ")} />
        ))}
        {modules.map((_, i) => {
          const [x, y] = pt(i, 100);
          return <line key={i} className="rd-axis" x1={c} y1={c} x2={x} y2={y} />;
        })}
        <polygon className="rd-area" points={poly} />
        {modules.map((m, i) => {
          const [x, y] = pt(i, m.score);
          const [lx, ly] = pt(i, 122);
          return (
            <g key={m.key}>
              <circle className="rd-dot" cx={x} cy={y} r="4" />
              <text className="rd-label" x={lx} y={ly} textAnchor={lx < c - 4 ? "end" : lx > c + 4 ? "start" : "middle"} dominantBaseline="middle">
                {SHORT[m.key]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="panel-note">A rounder, bigger shape means a more balanced site. Dents show where to focus.</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Command palette + keyboard shortcuts                                 */
/* ------------------------------------------------------------------ */

export type Cmd = { id: string; label: string; hint?: string; group: "Go to" | "Actions" | "Findings"; icon?: ModuleKey; run: () => void };

export function CommandPalette({ open, onClose, cmds }: { open: boolean; onClose: () => void; cmds: Cmd[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cmds.filter((c) => !needle || `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(needle)).slice(0, 30);
  }, [cmds, q]);

  const go = (c: Cmd | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  return (
    <dialog ref={ref} className="cmdk" aria-label="Command palette" onClose={() => { setQ(""); setIdx(0); onClose(); }}>
      <input
        autoFocus
        className="cmdk-in"
        placeholder="Jump to an area, a finding or an action…"
        aria-label="Search commands"
        value={q}
        onChange={(e) => { setQ(e.target.value); setIdx(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, shown.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); go(shown[idx]); }
        }}
      />
      <ul className="cmdk-list" role="listbox" aria-label="Results">
        {shown.length === 0 && <li className="cmdk-empty">Nothing found</li>}
        {shown.map((c, i) => (
          <li key={c.id} role="option" aria-selected={i === idx}>
            {(i === 0 || shown[i - 1].group !== c.group) && <span className="cmdk-group">{c.group}</span>}
            <button type="button" tabIndex={-1} className={i === idx ? "on" : ""} onMouseMove={() => setIdx(i)} onClick={() => go(c)}>
              {c.icon ? <AreaIcon k={c.icon} size={16} /> : <span className="cmdk-bullet" aria-hidden="true" />}
              <span className="cmdk-l">{c.label}</span>
              {c.hint && <span className="cmdk-h">{c.hint}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="cmdk-foot"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>Enter</kbd> select <kbd>Esc</kbd> close</p>
    </dialog>
  );
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
};

/** Global keys: Ctrl/Cmd+K palette, ? help, J/K move through findings, X toggles fixed, 1-9 switch area. */
export function useShortcuts(o: { openPalette: () => void; openHelp: () => void; views: string[]; setView: (v: string) => void; toggleKey: (key: string) => void }) {
  const ref = useRef(o);
  useEffect(() => {
    ref.current = o;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const r = ref.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        r.openPalette();
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "?") return r.openHelp();
      if (e.key === "/") {
        e.preventDefault();
        return r.openPalette();
      }
      if (/^[1-9]$/.test(e.key) && r.views[Number(e.key) - 1]) return r.setView(r.views[Number(e.key) - 1]);
      const items = [...document.querySelectorAll<HTMLElement>(".dash-main .fnd")];
      if (!items.length) return;
      const cur = items.findIndex((x) => x.hasAttribute("data-active"));
      if (e.key === "j" || e.key === "k") {
        const next = e.key === "j" ? Math.min(cur + 1, items.length - 1) : Math.max(cur - 1, 0);
        items.forEach((x) => x.removeAttribute("data-active"));
        items[next].setAttribute("data-active", "");
        items[next].scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      } else if (e.key === "x" && cur >= 0) {
        const k = items[cur].getAttribute("data-k");
        if (k) r.toggleKey(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const rows: [string, string][] = [
    ["Ctrl / ⌘ K  or  /", "Open the command palette"],
    ["1 – 9", "Switch between Overview, All findings and each area"],
    ["J / K", "Move down / up through findings"],
    ["X", "Mark the highlighted finding as fixed"],
    ["?", "Show this help"],
  ];
  return (
    <dialog ref={ref} className="cmdk help" aria-labelledby="sc-h" onClose={onClose}>
      <h2 id="sc-h">Keyboard shortcuts</h2>
      <dl>
        {rows.map(([k, d]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="dash-btn" onClick={onClose}>Close</button>
    </dialog>
  );
}

export type { Finding };
