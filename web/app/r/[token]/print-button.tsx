"use client";

export function PrintButton() {
  return (
    <button type="button" className="br-print" onClick={() => window.print()}>
      Download PDF
    </button>
  );
}
