"use client";

import { useState } from "react";

/** The developer snippet on a fix guide, with a one-click copy button. */
export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* clipboard blocked: the code stays selectable */
    }
  };
  return (
    <div className="guide-codebox">
      <pre className="guide-code" tabIndex={0}>{code}</pre>
      <button type="button" className="guide-copy" onClick={copy} aria-live="polite">
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
