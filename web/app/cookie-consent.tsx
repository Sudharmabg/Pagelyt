"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { sessionFresh } from "@/lib/session-age";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  ageBucket,
  hashId,
  pageInfo,
  pushPageContext,
  type DlUser,
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

  // Page views plus the dataLayer's page_context (page type, user state, consent, environment). The short wait lets the
  // new page's <title> land first; the user check is local (the saved session), so it adds no network call.
  useEffect(() => {
    let live = true;
    const t = window.setTimeout(async () => {
      let user: DlUser = { logged_in: false };
      try {
        const { data } = (await supabaseBrowser()?.auth.getSession()) ?? { data: null };
        const s = data?.session;
        if (s && sessionFresh(s.access_token)) user = { logged_in: true, user_hash: await hashId(s.user.id), account_age: ageBucket(s.user.created_at) };
      } catch {
        /* signed-out is the safe answer */
      }
      if (!live) return;
      pushPageContext(user);
      trackPageView();
    }, 150);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [path]);

  // Engagement and forms, reset on each page: scroll depth, FAQ opens, outbound links, form start / submit / error.
  // Field names only, never values.
  useEffect(() => {
    if (isUntracked(path)) return;
    const seen = new Set<number>();
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h < 400) return;
      const pct = Math.round((window.scrollY / h) * 100);
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !seen.has(m)) {
          seen.add(m);
          track("scroll_depth", { percent: m, page_path: location.pathname, ...pageInfo(location.pathname) });
        }
      }
    };
    const formId = (f: Element) => f.id || f.getAttribute("aria-label") || f.getAttribute("data-form") || f.getAttribute("name") || "form";
    const started = new WeakSet<Element>();
    const failed = new WeakSet<Element>();
    const onFocus = (e: FocusEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      const form = el?.closest("form");
      if (!el || !form || !el.matches("input, select, textarea") || started.has(form) || form.closest(".ck")) return;
      started.add(form);
      track("form_start", { form_id: formId(form), field: (el as HTMLInputElement).name || el.id || undefined, page_path: location.pathname });
    };
    const onSubmit = (e: Event) => {
      const form = e.target instanceof Element ? e.target : null;
      if (form) track("form_submit", { form_id: formId(form), page_path: location.pathname });
    };
    const onInvalid = (e: Event) => {
      const el = e.target instanceof Element ? e.target : null;
      const form = el?.closest("form");
      if (!el || !form || failed.has(form)) return;
      failed.add(form);
      window.setTimeout(() => failed.delete(form), 2000);
      track("form_error", { form_id: formId(form), field: (el as HTMLInputElement).name || el.id || undefined, page_path: location.pathname });
    };
    const onToggle = (e: Event) => {
      const d = e.target;
      if (d instanceof HTMLDetailsElement && d.open) {
        track("faq_open", { question: (d.querySelector("summary")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100), page_path: location.pathname });
      }
    };
    const onLink = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a) return;
      try {
        const u = new URL((a as HTMLAnchorElement).href, location.href);
        if (/^https?:$/.test(u.protocol) && u.hostname !== location.hostname) {
          track("outbound_click", { link_domain: u.hostname, link_url: u.origin + u.pathname, page_path: location.pathname });
        }
      } catch {
        /* not a URL */
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocus);
    document.addEventListener("submit", onSubmit, { capture: true });
    document.addEventListener("invalid", onInvalid, { capture: true });
    document.addEventListener("toggle", onToggle, { capture: true });
    document.addEventListener("click", onLink, { capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("submit", onSubmit, { capture: true });
      document.removeEventListener("invalid", onInvalid, { capture: true });
      document.removeEventListener("toggle", onToggle, { capture: true });
      document.removeEventListener("click", onLink, { capture: true });
    };
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
