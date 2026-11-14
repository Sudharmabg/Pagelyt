"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GoogleMark } from "./google-data";
import type { GoogleState } from "./use-google";

/* The Google integrations banner at the top of Overview (owner only). It says what each Google product adds to
   the report and offers the next step: upgrade (free plan), connect, finish linking, or open the data.
   Dismissing hides it on this browser until something new can be connected. */

const PRODUCTS = [
  { key: "gsc", name: "Search Console", lines: ["Real clicks at stake on every issue", "Searches close to page one", "Indexing check on key pages"] },
  { key: "ga4", name: "Analytics", lines: ["Visitors reached by each issue", "Drop detective for pages losing visits", "28-day traffic report"] },
  { key: "ads", name: "Google Ads", lines: ["Ad spend landing on broken pages", "Paid vs organic overlap", "What your free traffic is worth"] },
] as const;

const KEY = "pl-gbanner";

export function GoogleBanner({ g, paid, onOpen }: { g: GoogleState; paid: boolean; onOpen: () => void }) {
  const s = g.status;
  const linked = { gsc: !!s?.property, ga4: !!s?.ga4Property, ads: !!s?.adsCustomer };
  const sig = `${paid ? 1 : 0}${+linked.gsc}${+linked.ga4}${+linked.ads}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let v: string | null = null;
    try {
      v = window.localStorage.getItem(KEY);
    } catch {}
    const t = window.setTimeout(() => setHidden(v === sig), 0);
    return () => window.clearTimeout(t);
  }, [sig]);
  if (!s?.configured || hidden) return null;
  const products = PRODUCTS.filter((p) => p.key !== "ads" || s.adsOn !== false);
  const done = products.filter((p) => linked[p.key]).length;

  const dismiss = () => {
    try {
      window.localStorage.setItem(KEY, sig);
    } catch {}
    setHidden(true);
  };

  const title = !paid
    ? "See the real Google numbers behind every issue"
    : done === 0
      ? "Connect Google to rank fixes by real traffic"
      : done < products.length
        ? `${done} of ${products.length} Google products connected`
        : "Your Google data is connected";
  const lead = !paid
    ? "Professional and Business plans connect Search Console, Analytics and Google Ads to this report, read-only."
    : done === products.length
      ? "Clicks, visitors and ad spend now sit next to every finding, with AI insights from your own numbers."
      : "One read-only connection. Pagelyt joins your Google numbers to this report and refreshes them once a day.";

  return (
    <section className="g-banner" aria-labelledby="g-banner-h">
      <button type="button" className="g-banner-x" onClick={dismiss} aria-label="Hide this banner">×</button>
      <div className="g-banner-head">
        <span className="g-banner-mark" aria-hidden="true"><GoogleMark /></span>
        <div>
          <p className="dash-eyebrow">Google integrations{!paid && <span className="plan-badge">Pro &amp; Business</span>}</p>
          <h2 id="g-banner-h">{title}</h2>
          <p className="g-banner-lead">{lead}</p>
        </div>
      </div>
      <ul className="g-banner-list">
        {products.map((p) => (
          <li key={p.key} className={linked[p.key] ? "on" : ""}>
            <b>{p.name}<span>{linked[p.key] ? "Connected" : paid ? "Not connected" : "Pro"}</span></b>
            <ul>{p.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          </li>
        ))}
        <li className="g-banner-ai">
          <b>AI insights<span>{done ? "Ready" : "After connecting"}</span></b>
          <ul><li>Plain-English findings from your own numbers, each with a next step</li></ul>
        </li>
      </ul>
      <div className="g-banner-act">
        {!paid ? (
          <>
            <Link className="dash-btn primary" href="/pricing">See plans</Link>
            <Link className="fnd-link" href="/features/google-integrations">How it works</Link>
          </>
        ) : (
          <>
            <button type="button" className="dash-btn primary" onClick={onOpen}>{done === 0 ? "Connect Google" : done < products.length ? "Connect the rest" : "Open Google data"}</button>
            <span className="g-banner-fine">Read-only. Disconnect any time from your account page.</span>
          </>
        )}
      </div>
    </section>
  );
}
