"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AreaIcon, type IconKey } from "./icons";
import { ModalX } from "../modal-close";

/* The modal behind the dashboard's Share, Export and More buttons: a title, an optional top slot (Share puts the
   report link there) and a grid of large option tiles. Built on <dialog>, so Escape, the backdrop and focus
   trapping come from the browser. */
export function ActionModal({ open, onClose, title, sub, icon, top, children }: { open: boolean; onClose: () => void; title: string; sub?: string; icon: IconKey; top?: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="amodal"
      aria-labelledby={`am-${icon}`}
      onClose={onClose}
      // A click on the backdrop (the dialog element itself, outside the card) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="am-card">
        <header className="am-head">
          <span className="am-ico"><AreaIcon k={icon} size={22} /></span>
          <div>
            <h2 id={`am-${icon}`}>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <ModalX onClick={onClose} />
        </header>
        {top}
        <ul className="am-grid">{children}</ul>
      </div>
    </dialog>
  );
}

/** One option in an ActionModal. `done` swaps the text for a short confirmation ("Copied"). */
export function Tile({ icon, title, text, onClick, href, done, busy, badge, tone }: { icon: IconKey; title: string; text: string; onClick?: () => void; href?: string; done?: string; busy?: boolean; badge?: string; tone?: "accent" }) {
  const inner = (
    <>
      <span className="at-ico"><AreaIcon k={icon} size={20} /></span>
      <span className="at-txt">
        <b>{title}{badge && <span className="plan-badge">{badge}</span>}</b>
        <span aria-live="polite">{done ?? text}</span>
      </span>
      <span className="at-go" aria-hidden="true">{done ? "✓" : "→"}</span>
    </>
  );
  const cls = `at${tone ? ` at-${tone}` : ""}${done ? " at-done" : ""}`;
  return (
    <li>
      {href ? (
        <Link className={cls} href={href}>{inner}</Link>
      ) : (
        <button type="button" className={cls} onClick={onClick} disabled={busy} aria-busy={busy}>{inner}</button>
      )}
    </li>
  );
}
