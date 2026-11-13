"use client";

/* One way to close every modal: the × in the corner (`ModalX`), Esc (the browser's <dialog> does this), and a
   click outside the card (`onBackdrop`). Modals that must not close while busy pass `disabled` / check it before
   calling close. */

/* Close when the click lands outside the dialog's box (on the backdrop). Measured against the box rather than
   comparing targets, so a click in a dialog's own padding never counts as outside. */
export function onBackdrop(e: React.MouseEvent<HTMLDialogElement>, close: () => void) {
  const d = e.currentTarget;
  if (e.target !== d) return;
  const r = d.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
}

export function ModalX({ onClick, disabled, label = "Close" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" className="mx" aria-label={label} title={`${label} (Esc)`} onClick={onClick} disabled={disabled}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </button>
  );
}
