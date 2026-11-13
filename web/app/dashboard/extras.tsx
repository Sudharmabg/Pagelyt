"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AreaIcon } from "./icons";
import { ModalX, onBackdrop } from "../modal-close";
import type { Finding, ModuleKey } from "@/lib/scan/types";

/* ------------------------------------------------------------------ */
/* Command palette + keyboard shortcuts                                 */
/* ------------------------------------------------------------------ */

export type Cmd = { id: string; label: string; hint?: string; group: "Go to" | "Tools" | "Actions" | "Findings"; icon?: ModuleKey; run: () => void };

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
    <dialog ref={ref} className="cmdk" aria-label="Command palette" onClose={() => { setQ(""); setIdx(0); onClose(); }} onClick={(e) => onBackdrop(e, onClose)}>
      <ModalX onClick={onClose} />
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
export function useShortcuts(o: { openPalette: () => void; openHelp: () => void; views: string[]; setView: (v: string) => void; toggleKey: (key: string) => void; step?: (d: 1 | -1) => void }) {
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
      // ← / → move to the previous / next section, unless focus is somewhere arrows already mean something.
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.shiftKey && r.step && !(e.target as HTMLElement | null)?.closest?.('[role="tablist"], [role="slider"], [role="listbox"], select, .chip-rail, [data-arrows]')) {
        e.preventDefault();
        return r.step(e.key === "ArrowLeft" ? -1 : 1);
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
    ["1 – 9", "Jump to the first nine sections in the sidebar"],
    ["← / →", "Previous / next section in the sidebar"],
    ["J / K", "Move down / up through findings"],
    ["X", "Mark the highlighted finding as fixed"],
    ["?", "Show this help"],
  ];
  return (
    <dialog ref={ref} className="cmdk help" aria-labelledby="sc-h" onClose={onClose} onClick={(e) => onBackdrop(e, onClose)}>
      <ModalX onClick={onClose} />
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
