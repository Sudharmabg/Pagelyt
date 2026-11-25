"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ModalX } from "./modal-close";

const noop = () => () => {};

/* The "Show all N" modal: every row of a table in a scrolling dialog, instead of stretching the page.
   Built on <dialog>, so Escape, the backdrop and focus come from the browser. Portalled to the dashboard root
   (for its dark theme) or the body. Clicking a link or button inside `closeOnPick` closes it, so a drill-down
   panel opened from a row isn't hidden behind the modal. */
export function TableModal({ open, onClose, title, note, children, closeOnPick }: { open: boolean; onClose: () => void; title: string; note?: string; children: ReactNode; closeOnPick?: string }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, mounted]);
  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={ref}
      className="amodal tbl-modal"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
        else if (closeOnPick && (e.target as HTMLElement).closest(closeOnPick)) requestAnimationFrame(onClose);
      }}
    >
      <div className="am-card">
        <header className="tbl-head">
          <div>
            <h2>{title}</h2>
            {note && <p>{note}</p>}
          </div>
          <ModalX onClick={onClose} />
        </header>
        <div className="tbl-body">{children}</div>
      </div>
    </dialog>,
    document.querySelector(".dash") ?? document.body
  );
}
