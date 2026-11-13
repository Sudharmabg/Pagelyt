"use client";

import { useEffect } from "react";

/* Opened from the dashboard's "Save as PDF" (?auto=1): opens the browser's print window once the page has loaded,
   so the saved PDF is the full report with every issue, whatever dashboard section was on screen. */
export function AutoPrint() {
  useEffect(() => {
    const go = () => window.setTimeout(() => window.print(), 300);
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);
  return null;
}
