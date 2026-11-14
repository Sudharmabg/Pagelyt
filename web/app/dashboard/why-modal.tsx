"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AreaIcon, type IconKey } from "./icons";
import { ModalX } from "../modal-close";

const noop = () => () => {};

export type WhyFact = { value: string; label: string; tone?: "good" | "ok" | "bad" };

/* "Why it matters" on every dashboard page: a small button in the banner that opens a modal with the reason,
   the numbers behind it for this site, and a way to jump to the fixes. The dialog is portalled to the dashboard root so it
   doesn't pick up the banner's white text. Built on <dialog>, so Escape, the backdrop and focus come from the browser. */
export function WhyItMatters({ title, text, icon, facts = [], color, action }: { title: string; text: string; icon: IconKey; facts?: WhyFact[]; color?: string; action?: { label: string; onClick: () => void } }) {
  const [open, setOpen] = useState(false);
  // False on the server and during hydration, true after: the portal needs the page's DOM.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const id = `why-${icon}`;
  return (
    <>
      <button type="button" className="why-btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span aria-hidden="true">?</span>Why it matters
      </button>
      {mounted &&
        createPortal(
          <dialog
            ref={ref}
            className="amodal why-modal"
            aria-labelledby={id}
            onClose={() => setOpen(false)}
            onClick={(e) => {
              if (e.target === e.currentTarget) e.currentTarget.close();
            }}
            style={color ? { ["--tc" as string]: color } : undefined}
          >
            <div className="am-card">
              <header className="am-head">
                <span className="am-ico why-ico"><AreaIcon k={icon} size={22} /></span>
                <div>
                  <p className="why-kicker">Why it matters</p>
                  <h2 id={id}>{title}</h2>
                </div>
                <ModalX onClick={() => setOpen(false)} />
              </header>
              <p className="why-text">{text}</p>
              {facts.length > 0 && (
                <div className="why-facts">
                  <h3>On this site</h3>
                  <ul>
                    {facts.map((f) => (
                      <li key={f.label} className={f.tone ? `st-${f.tone}` : undefined}>
                        <b>{f.value}</b>
                        <span>{f.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="why-actions">
                {action && (
                  <button
                    type="button"
                    className="dash-btn primary"
                    onClick={() => {
                      setOpen(false);
                      action.onClick();
                    }}
                  >
                    {action.label} <span aria-hidden="true">↓</span>
                  </button>
                )}
                <button type="button" className="dash-btn" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>
          </dialog>,
          // Inside the dashboard root (for its dark theme), but outside the banner.
          document.querySelector(".dash") ?? document.body
        )}
    </>
  );
}
