"use client";

import { useState } from "react";
import { downloadPdf } from "@/lib/download-pdf";

/* On a shared link, asks the server for a branded PDF (when the sharing account is on a paid plan);
   otherwise, and on the demo page, it opens the browser's print dialog. */
export function PrintButton({ token }: { token?: string }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!token) return window.print();
    setBusy(true);
    await downloadPdf({ token });
    setBusy(false);
  };
  return (
    <button type="button" className="br-print" onClick={go} disabled={busy}>
      {busy ? "Preparing PDF…" : "Download PDF"}
    </button>
  );
}
