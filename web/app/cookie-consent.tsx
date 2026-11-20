"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CONSENT_OPEN_EVENT,
  isUntracked,
  openCookieSettings,
  readConsent,
  saveConsent,
  track,
  trackPageView,
} from "@/lib/analytics";

/* The cookie banner and the site-wide GA4 hooks, mounted once in the root layout.
   - Bottom bar on first visit: Accept all / Reject all / Settings (Essential always on, Analytics optional).
   - The footer's "Cookie settings" link reopens it in Settings view.
   - Sends a page view on every route change, and tracks clicks site-wide without touching each component:
     tabs (role="tab") → tab_switch, links to plans → upgrade_click, buttons (.btn, .dash-btn) → cta_click. */

const UPGRADE_HREF = /^\/(pricing|consultation\?topic=agency)/;

export function CookieConsent() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  // First visit: no choice saved yet. Deferred a tick so the bar slides in after the page paints.
  useEffect(() => {
    if (readConsent()) return;
    const t = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const reopen = () => {
      setAnalytics(readConsent() === "granted");
      setSettings(true);
      setOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  // Page views. The short wait lets the new page's <title> land first.
  useEffect(() => {
    const t = window.setTimeout(trackPageView, 150);
    return () => window.clearTimeout(t);
  }, [path]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el || el.closest(".ck")) return;
      const label = (n: Element) => (n.getAttribute("aria-label") || n.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
      const tab = el.closest('[role="tab"]');
      if (tab) return track("tab_switch", { tab_label: label(tab), page_path: location.pathname });
      const link = el.closest("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (link && UPGRADE_HREF.test(href)) return track("upgrade_click", { link_url: href, link_text: label(link), page_path: location.pathname });
      const cta = el.closest(".btn, .dash-btn, [data-cta]");
      if (cta) track("cta_click", { cta_label: label(cta), link_url: href || undefined, page_path: location.pathname });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  if (!open || isUntracked(path)) return null;

  const choose = (c: "granted" | "denied") => {
    saveConsent(c);
    setOpen(false);
    setSettings(false);
  };

  return (
    <section className="ck" role="dialog" aria-modal="false" aria-labelledby="ck-title">
      <div className="ck-in">
        <div className="ck-text">
          <h2 id="ck-title">Cookies on Pagelyt</h2>
          <p>
            Essential storage keeps you signed in and remembers this choice. With your OK, we also use Google Analytics to
            see which pages help people. <Link href="/privacy#cookies">Cookie details</Link>
          </p>
        </div>

        {settings && (
          <div className="ck-opts">
            <div className="ck-opt">
              <div>
                <strong>Essential</strong>
                <span>Sign-in and your cookie choice. Always on.</span>
              </div>
              <button type="button" role="switch" aria-checked="true" aria-label="Essential storage" className="ck-sw on" disabled />
            </div>
            <div className="ck-opt">
              <div>
                <strong>Analytics</strong>
                <span>Google Analytics: pages visited and features used. No ads.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={analytics}
                aria-label="Analytics cookies"
                className={`ck-sw${analytics ? " on" : ""}`}
                onClick={() => setAnalytics((a) => !a)}
              />
            </div>
          </div>
        )}

        <div className="ck-acts">
          {settings ? (
            <>
              <button type="button" className="btn ghost sm" onClick={() => choose("denied")}>Reject all</button>
              <button type="button" className="btn sm" onClick={() => choose(analytics ? "granted" : "denied")}>Save choices</button>
            </>
          ) : (
            <>
              <button type="button" className="ck-link" onClick={() => setSettings(true)}>Settings</button>
              <button type="button" className="btn ghost sm" onClick={() => choose("denied")}>Reject all</button>
              <button type="button" className="btn sm" onClick={() => choose("granted")}>Accept all</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/** Footer link that reopens the banner. */
export function CookieSettingsLink() {
  return (
    <button type="button" className="ck-foot" onClick={openCookieSettings}>
      Cookie settings
    </button>
  );
}
