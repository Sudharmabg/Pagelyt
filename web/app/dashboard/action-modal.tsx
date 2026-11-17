"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AreaIcon, type IconKey } from "./icons";
import { ModalX } from "../modal-close";

/* The modal behind the dashboard's Share, Export and More buttons: a title, an optional top slot (Share puts the
   report link there) and a grid of large option tiles. Built on <dialog>, so Escape, the backdrop and focus
   trapping come from the browser. */
export function ActionModal({ open, onClose, title, sub, icon, top, children, variant }: { open: boolean; onClose: () => void; title: string; sub?: string; icon: IconKey; top?: React.ReactNode; children: React.ReactNode; variant?: "rich" | "rich3" }) {
  const ref = useRef<HTMLDialogElement>(null);
  // The latest `open`, read when the dialog's close event fires. That event comes after the render that closed it,
  // so when the parent closed this modal to open another (the phone Actions sheet opening Share), calling onClose
  // there would wipe out the new modal. Only a close the user started (Escape, backdrop, X) reports back.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`amodal${variant ? ` amodal-rich${variant === "rich3" ? " amodal-rich3" : ""}` : ""}`}
      aria-labelledby={`am-${icon}`}
      onClose={() => {
        if (openRef.current) onClose();
      }}
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

/** An Avara-style option card for the rich modals (Share, Export, More): a header row with a pill tag, an
    illustrated preview that moves on hover (`art`, decorative), the description and an action button. `color` tints
    the icon, preview and button for that option. `done` swaps the text for a short confirmation. */
export function ArtCard({ kind, icon, tag, title, text, cta, art, onClick, href, busy, done, badge, color }: { kind?: string; icon: IconKey; tag?: string; title: string; text: string; cta: string; art: React.ReactNode; onClick?: () => void; href?: string; busy?: boolean; done?: string; badge?: string; color?: string }) {
  const cls = `exc${kind ? ` exc-${kind}` : ""}${done ? " exc-done" : ""}`;
  const style = color ? ({ ["--xc" as string]: color } as React.CSSProperties) : undefined;
  const inner = (
    <>
      <span className="exc-head">
        <span className="exc-ico"><AreaIcon k={icon} size={16} /></span>
        <b>{title}</b>
        {(badge || tag) && <span className={`exc-tag${badge ? " exc-paid" : ""}`}>{badge ?? tag}</span>}
      </span>
      <span className="exc-prev" aria-hidden="true">{art}</span>
      <span className="exc-txt" aria-live="polite">{done ?? text}</span>
      <span className="exc-cta">
        {done ? "✓ Done" : cta}
        <span className="exc-arrow" aria-hidden="true">→</span>
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link className={cls} href={href} style={style}>{inner}</Link>
      ) : (
        <button type="button" className={cls} style={style} onClick={onClick} disabled={busy} aria-busy={busy}>{inner}</button>
      )}
    </li>
  );
}

/** Decorative orbit for a rich card: a glowing centre icon with smaller icons circling it (they spin on hover). */
export function OrbitArt({ icon, ring }: { icon: IconKey; ring: IconKey[] }) {
  return (
    <span className="xo">
      <i className="xo-track" />
      <i className="xo-spin">
        {ring.map((k, i) => (
          <i key={k + i} className="xo-dot" style={{ ["--k" as string]: i, ["--n" as string]: ring.length }}>
            <AreaIcon k={k} size={12} />
          </i>
        ))}
      </i>
      <i className="xo-core"><AreaIcon k={icon} size={20} /></i>
    </span>
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
