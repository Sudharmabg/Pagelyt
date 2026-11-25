"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChartColumn, Eye, Layers, Megaphone, MousePointerClick, Search, Target, Timer, Users, Wallet, X, type LucideIcon } from "lucide-react";
import type { Finding } from "@/lib/scan/types";
import type { Ga4Insight, Metric, Source } from "@/lib/google/ga4-insights";
import type { GoogleState } from "./use-google";
import { AiMark, FindingLink, GoogleNav, PageLink } from "./google-kit";
import { Busy } from "./google-data";
import { BannerFx } from "./banner-fx";

/* The AI insights modal of the ★ Google data view, opened from the "AI insights" button in its header (and from the
   Overview teaser). Tabs: Combined (every connected product read together, when two or more are connected), then
   Search Console, Analytics and Google Ads. Each insight names the key metric it would grow, today's number, a careful
   estimate of the gain and 2 or 3 steps. Full-screen sheet on phones, where the tabs can also be swiped. */

export type AiTab = "all" | Source;

const TAB: Record<AiTab, { label: string; icon: LucideIcon; source: string }> = {
  all: { label: "Combined", icon: Layers, source: "Search Console, Analytics and Google Ads together" },
  gsc: { label: "Search Console", icon: Search, source: "Search Console" },
  ga4: { label: "Analytics", icon: ChartColumn, source: "Analytics" },
  ads: { label: "Google Ads", icon: Megaphone, source: "Google Ads" },
};

export const METRIC: Record<Metric, { label: string; icon: LucideIcon }> = {
  search_clicks: { label: "Search clicks", icon: MousePointerClick },
  search_visibility: { label: "Search visibility", icon: Eye },
  visits: { label: "Visits", icon: Users },
  engagement: { label: "Engagement", icon: Timer },
  conversions: { label: "Conversions", icon: Target },
  ad_efficiency: { label: "Ad efficiency", icon: Wallet },
};
const SRC: Record<Source, string> = { gsc: "Search Console", ga4: "Analytics", ads: "Google Ads" };
const EFFORT = { quick: "Quick job", moderate: "A few hours", bigger: "Bigger project" } as const;
const PRIORITY = { high: "Biggest win", medium: "Worth doing", low: "Smaller win" } as const;

type Result = { insights: Ga4Insight[]; at: string; current: boolean } | null;

/** The four categories the modal always shows, whether or not the product is connected yet. */
const ALL_TABS: AiTab[] = ["all", "gsc", "ga4", "ads"];
const PRODUCT: Record<Source, { name: string; pitch: string }> = {
  gsc: { name: "Search Console", pitch: "the searches that bring people to your site, the pages close to page one, pages losing clicks and pages Google has not indexed" },
  ga4: { name: "Google Analytics", pitch: "where visitors come from, which pages lose them, and which channels are growing or shrinking" },
  ads: { name: "Google Ads", pitch: "where ad money is wasted, which searches convert, and how paid and organic traffic overlap" },
};

/** The tabs this site can use: each linked product with numbers, plus Combined with two or more. */
export function aiTabs(g: GoogleState): AiTab[] {
  const s = g.status;
  const have: Source[] = [];
  if (s?.property && g.gsc) have.push("gsc");
  if (s?.ga4Property && g.ga4) have.push("ga4");
  if (s?.adsCustomer && s.adsOn !== false && g.ads) have.push("ads");
  return have.length >= 2 ? ["all", ...have] : have;
}

function slot(g: GoogleState, t: AiTab): { ai: Result; busy: boolean; error: string; run: (scanId: string, force: boolean) => Promise<void> } {
  if (t === "all") return { ai: g.allAi, busy: g.busy === "allanalyse", error: g.allAiError, run: g.analyseAll };
  if (t === "gsc") return { ai: g.gscAi, busy: g.busy === "gscanalyse", error: g.gscAiError, run: g.analyseGsc };
  if (t === "ads") return { ai: g.adsAi, busy: g.busy === "adsanalyse", error: g.adsAiError, run: g.analyseAds };
  return { ai: g.ai, busy: g.busy === "analyse", error: g.aiError, run: g.analyse };
}

/** Every insight ready so far, combined ones first, most important first. */
export function allInsights(g: GoogleState): (Ga4Insight & { from: AiTab })[] {
  const RANK = { high: 0, medium: 1, low: 2 } as const;
  return [
    ...(g.allAi?.insights ?? []).map((i) => ({ ...i, from: "all" as AiTab })),
    ...(g.gscAi?.insights ?? []).map((i) => ({ ...i, from: "gsc" as AiTab })),
    ...(g.ai?.insights ?? []).map((i) => ({ ...i, from: "ga4" as AiTab })),
    ...(g.adsAi?.insights ?? []).map((i) => ({ ...i, from: "ads" as AiTab })),
  ].sort((a, b) => RANK[a.priority] - RANK[b.priority]);
}

/** The header button. */
export function AiButton({ g, onOpen }: { g: GoogleState; onOpen: () => void }) {
  const n = allInsights(g).length;
  if (!aiTabs(g).length) return null;
  return (
    <button type="button" className="gd-ai-btn gd-bn" onClick={onOpen} aria-haspopup="dialog">
      <BannerFx sparks={4} />
      <AiMark /> AI insights
      {n > 0 && <span className="gd-ai-n" aria-label={`${n} ready`}>{n}</span>}
    </button>
  );
}

export function AiInsightsModal({ g, scanId, findings, start, onClose }: { g: GoogleState; scanId: string; findings: Finding[]; start: AiTab | null; onClose: () => void }) {
  const ready = aiTabs(g);
  const tabs = ALL_TABS;
  const [tab, setTab] = useState<AiTab>(() => (start && tabs.includes(start) ? start : ready[0] ?? "all"));
  const close = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<AiTab, HTMLButtonElement | null>>>({});
  // The modal's page and finding links close it first, then use the Google data view's own navigation.
  const parent = useContext(GoogleNav);
  const inner = useMemo(() => (parent ? { openPage: (u: string) => { onClose(); parent.openPage(u); }, openFinding: (f: Finding) => { onClose(); parent.openFinding(f); } } : null), [parent, onClose]);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = was;
      back?.focus?.();
    };
  }, [onClose]);

  const pick = (t: AiTab) => {
    setTab(t);
    body.current?.scrollTo({ top: 0 });
    tabRefs.current[t]?.scrollIntoView({ block: "nearest", inline: "center" });
  };
  const step = (d: 1 | -1) => {
    const i = tabs.indexOf(tab) + d;
    if (i >= 0 && i < tabs.length) pick(tabs[i]);
  };

  // Phones: swipe sideways across the insights to move between tabs.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  };

  const cur = slot(g, tab);
  const meta = TAB[tab];

  // Drawn at the dashboard's root, not inside the Google section: that section fades in when scrolled to, so a modal
  // opened from elsewhere (the Overview's Analytics card) or before it is on screen would stay invisible.
  // It only ever opens after a click (never on the server), so the root can be looked up straight away.
  const [host] = useState<Element | null>(() => (typeof document === "undefined" ? null : document.querySelector(".dash") ?? document.body));
  if (!host) return null;
  return createPortal(
    <div className="gd-aim-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gd-aim" role="dialog" aria-modal="true" aria-labelledby="gd-aim-h">
        <div className="gd-aim-top gd-bn">
          <BannerFx />
          <header className="gd-aim-head">
            <div className="gd-aim-title">
              <AiMark />
              <div>
                <h2 id="gd-aim-h">AI insights</h2>
                <p>Your biggest chances to grow clicks, visits and conversions, from your Google numbers and this report.</p>
              </div>
            </div>
            <button ref={close} type="button" className="gd-aim-x" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button>
          </header>

          {(
            <div className="gd-aim-tabs" role="tablist" aria-label="Insights from" onKeyDown={(e) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }}>
              {tabs.map((t) => {
                const Ic = TAB[t].icon;
                const n = slot(g, t).ai?.insights.length ?? 0;
                const on = ready.includes(t);
                return (
                  <button
                    key={t}
                    ref={(el) => { tabRefs.current[t] = el; }}
                    type="button"
                    role="tab"
                    id={`gd-aim-t-${t}`}
                    aria-selected={tab === t}
                    aria-controls="gd-aim-panel"
                    tabIndex={tab === t ? 0 : -1}
                    className={[t === "all" ? "all" : "", on ? "" : "off"].join(" ").trim() || undefined}
                    onClick={() => pick(t)}
                  >
                    <Ic aria-hidden="true" />
                    {TAB[t].label}
                    {on ? n > 0 && <span className="gd-aim-tn">{n}</span> : <span className="gd-aim-tn off">Connect</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div ref={body} className="gd-aim-body" id="gd-aim-panel" role="tabpanel" aria-labelledby={`gd-aim-t-${tab}`} aria-busy={cur.busy} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <GoogleNav.Provider value={inner}>
            <Panel key={tab} tab={tab} source={meta.source} cur={cur} findings={findings} ready={ready} g={g} scanId={scanId} products={tab === "all" ? (g.allAi?.products ?? ready.filter((t): t is Source => t !== "all")) : null} onRun={(force) => void cur.run(scanId, force)} />
          </GoogleNav.Provider>
        </div>

        {cur.ai && (
          <footer className="gd-aim-foot">
            <p>
              Written by AI on {new Date(cur.ai.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} from the last 28 days. Check before acting.
              {!cur.ai.current && <b> Your numbers have updated since.</b>}
            </p>
            <button type="button" className="dash-btn" onClick={() => void cur.run(scanId, true)} disabled={cur.busy}>{cur.busy ? "Analysing…" : "Analyse again"}</button>
          </footer>
        )}
      </div>
    </div>,
    host
  );
}

/** A category that isn't usable yet: says what the AI would find there and offers to connect what is missing. */
function ConnectCard({ tab, ready, g, scanId }: { tab: AiTab; ready: AiTab[]; g: GoogleState; scanId: string }) {
  const have = ready.filter((t): t is Source => t !== "all");
  const connecting = g.busy === "connect";
  const adsOff = g.status?.adsOn === false;
  if (tab === "all") {
    const missing = (["gsc", "ga4", "ads"] as Source[]).filter((p) => !have.includes(p) && !(p === "ads" && adsOff));
    return (
      <div className="gd-aim-empty">
        <h3>Combined insights need two products</h3>
        <p>Combined reads Search Console, Analytics and Google Ads side by side, so it can follow a visitor from the search to the sale. {have.length ? `You have ${have.map((p) => PRODUCT[p].name).join(" and ")} connected.` : "Nothing is connected yet."} Connect {have.length ? "one more" : "two"} to unlock it.</p>
        <div className="gd-aim-cta">
          {missing.map((p) => <button key={p} type="button" className="dash-btn primary" disabled={connecting} onClick={() => void g.connect(scanId, p)}>{connecting ? "Opening Google…" : `Connect ${PRODUCT[p].name}`}</button>)}
        </div>
      </div>
    );
  }
  const p = tab as Source;
  return (
    <div className="gd-aim-empty">
      <h3>Connect {PRODUCT[p].name} to get its AI insights</h3>
      <p>AI reads your {PRODUCT[p].name} numbers next to this report and shows {PRODUCT[p].pitch}. Each insight comes with the numbers behind it and a step-by-step plan.</p>
      {p === "ads" && adsOff ? (
        <p className="panel-note">Google Ads isn&rsquo;t switched on for this server yet.</p>
      ) : (
        <div className="gd-aim-cta"><button type="button" className="dash-btn primary" disabled={connecting} onClick={() => void g.connect(scanId, p)}>{connecting ? "Opening Google…" : `Connect ${PRODUCT[p].name}`}</button></div>
      )}
      {g.status?.[p === "gsc" ? "property" : p === "ga4" ? "ga4Property" : "adsCustomer"] && !g[p === "gsc" ? "gsc" : p === "ga4" ? "ga4" : "ads"] && <p className="panel-note">It is linked, but its numbers haven&rsquo;t loaded yet. Open its tab in Google data and press Refresh now.</p>}
    </div>
  );
}

function Panel({ tab, source, cur, findings, products, ready, g, scanId, onRun }: { tab: AiTab; source: string; cur: ReturnType<typeof slot>; findings: Finding[]; products: Source[] | null; ready: AiTab[]; g: GoogleState; scanId: string; onRun: (force: boolean) => void }) {
  const byId = useMemo(() => new Map(findings.map((f) => [f.id, f])), [findings]);
  if (!ready.includes(tab)) return <ConnectCard tab={tab} ready={ready} g={g} scanId={scanId} />;
  if (cur.busy && !cur.ai) {
    return (
      <div className="gd-aim-empty" role="status">
        <Busy label={tab === "all" ? "Reading all your Google numbers together…" : `Reading your ${source} numbers…`} />
        <p className="panel-note">This takes about half a minute.</p>
      </div>
    );
  }
  if (!cur.ai) {
    return (
      <div className="gd-aim-empty">
        {tab === "all" ? (
          <>
            <h3>See the whole journey, from search to sale</h3>
            <p>AI reads {products?.map((p) => SRC[p]).join(", ").replace(/, ([^,]*)$/, " and $1")} together with this report, page by page: the searches that bring people in, what they do on the site, and the ad money behind it. You get the few changes that would lift the most numbers at once.</p>
          </>
        ) : (
          <>
            <h3>Find your biggest wins in {source}</h3>
            <p>AI reads your last 28 days of {source} next to this report and picks the changes that would grow your numbers most, each with an estimate of the gain and the steps to take.</p>
          </>
        )}
        <button type="button" className="dash-btn primary" onClick={() => onRun(false)}>Analyse with AI</button>
        {cur.error && <p className="gd-note bad" role="alert">{cur.error}</p>}
      </div>
    );
  }
  const top = cur.ai.insights.find((i) => i.gain && !/hard to estimate/i.test(i.gain));
  return (
    <>
      <p className="gd-aim-sum">
        <b>{cur.ai.insights.length} opportunities</b>
        {top && <> · biggest: <span className="gd-gain-t">{top.gain}</span> {top.metric ? `(${METRIC[top.metric].label.toLowerCase()})` : ""}</>}
      </p>
      {cur.busy && <div className="gd-aim-again" role="status"><Busy label="Analysing again…" /></div>}
      <ol className="gd-insights">
        {cur.ai.insights.map((i, n) => <InsightCard key={i.title + n} i={i} n={n} byId={byId} showSources={tab === "all"} />)}
      </ol>
      {cur.error && <p className="gd-note bad" role="alert">{cur.error}</p>}
    </>
  );
}

export function InsightCard({ i, n, byId, showSources }: { i: Ga4Insight; n: number; byId: Map<string, Finding>; showSources?: boolean }) {
  const m = i.metric ? METRIC[i.metric] : null;
  const steps = i.steps?.length ? i.steps : i.action ? [i.action] : [];
  const MIc = m?.icon;
  return (
    <li className={`gd-insight p-${i.priority}`} style={{ ["--i" as string]: n }}>
      <div className="gd-insight-tags">
        {m && MIc && <span className={`gd-metric m-${i.metric}`}><MIc aria-hidden="true" />{m.label}</span>}
        <span className="gd-prio">{PRIORITY[i.priority]}</span>
        {showSources && i.sources?.map((s) => <span key={s} className={`gd-src s-${s}`}>{SRC[s]}</span>)}
      </div>
      <h3>{i.title}</h3>
      {(i.now || i.gain) && (
        <div className="gd-nowgain">
          {i.now && <div><small>Now</small><b>{i.now}</b></div>}
          {i.now && i.gain && <span className="gd-arrow" aria-hidden="true">→</span>}
          {i.gain && <div className={/hard to estimate/i.test(i.gain) ? "unk" : "gain"}><small>Possible gain</small><b>{i.gain}</b></div>}
        </div>
      )}
      <div className="gd-why"><h4>Why this matters</h4><p className="gd-insight-d">{i.detail}</p></div>
      {i.plan?.length ? (
        <details className="gd-play" open={n === 0}>
          <summary>
            <span className="gd-play-t">Step-by-step plan</span>
            <span className="gd-play-n">{i.plan.length} steps</span>
            {i.effort && <span className={`gd-effort e-${i.effort}`}>{EFFORT[i.effort]}</span>}
          </summary>
          {i.time && <p className="gd-play-time"><b>Time and results:</b> {i.time}</p>}
          <ol className="gd-plan">
            {i.plan.map((st, k) => (
              <li key={k}>
                <b>{st.title}</b>
                {st.how && <p>{st.how}</p>}
                {st.example && <blockquote><small>Example wording</small>{st.example}</blockquote>}
              </li>
            ))}
          </ol>
          {i.check && <p className="gd-check"><b>How to check it worked</b>{i.check}</p>}
        </details>
      ) : steps.length > 0 ? (
        <div className="gd-insight-steps">
          <h4>What to do</h4>
          <ol>{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      ) : null}
      {(i.pages.length > 0 || i.findings.length > 0) && (
        <p className="gd-ins-refs">
          {i.pages.map((p) => <PageLink key={p} url={p} />)}
          {i.findings.map((id) => {
            const f = byId.get(id);
            return f ? <FindingLink key={id} f={f} /> : null;
          })}
        </p>
      )}
    </li>
  );
}
