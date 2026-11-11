"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Findings } from "../findings";
import { Ring, tone } from "../ui";
import { findingKey, overallScore, scoreModules } from "@/lib/scan/score";
import { MODULE_NAMES, type ModuleKey } from "@/lib/scan/types";
import { AreaIcon, type IconKey } from "./icons";
import { SaveSite } from "./save-site";
import { ShareReport } from "./share-report";
import { RescanButton } from "./rescan";
import { AGENCY_UPSELL, AgencyModal, useAccount } from "./agency-modal";
import { CompareButton } from "./compare-button";
import { downloadPdf } from "@/lib/download-pdf";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { firstName, useSignedInUser } from "@/lib/use-signed-in";
import { AuthLink } from "../auth-link";
import { CommandPalette, RadarPanel, ShortcutHelp, useShortcuts, type Cmd } from "./extras";
import { ComparePanel, DomainPanel, ExportMenu, FindingsExplorer, CrawlPanel, ChangePanel, HowScores, ImagesPanel, QuickWins, TechPanel, VitalsPanel, useHistory, type Snap } from "./panels";
import type { StoredScan } from "@/lib/scan/store";
import { toolContext } from "@/lib/scan/tools-context";
import { Tools } from "../tools/tools";

/* One plain-English line per area, shown at the top of its breakdown. */
const BLURB: Record<ModuleKey, string> = {
  health: "Whether your site is online, loads reliably and is set up correctly for visitors.",
  performance: "How quickly your pages respond and load, which affects visitors and search rankings.",
  seo: "How easy it is for search engines to find, read and show your pages.",
  geo: "How ready your site is for AI assistants and AI search to read and quote.",
  security: "Basic protections that keep your visitors and your site safe.",
  accessibility: "How usable your site is for people with disabilities, including screen reader users.",
  domain: "Whether your domain, nameservers and email records are set up so that you stay reachable and hard to impersonate.",
  privacy: "Whether visitors can find your policies and whether tracking is handled in line with privacy laws.",
};

/* "Why it matters", shown under each page's description. Two short sentences, no figures we can't back up. */
const WHY: Record<ModuleKey | Extra, string> = {
  health: "If the site is down, redirects badly or shows errors, every visitor and every search crawler that arrives in that moment is lost. These are the problems to fix first, because nothing else counts while they last.",
  performance: "Slow pages lose visitors before they see anything, especially on phones and patchy connections. Google also uses page speed as a ranking signal, so speed affects how many people arrive in the first place.",
  seo: "Most people find a business through a search engine, and a page that can't be crawled or has no clear title won't be shown to them. Small fixes here often bring more visitors at no extra cost.",
  geo: "More people now ask ChatGPT, Perplexity and Google's AI answers instead of clicking through search results. Sites that are easy for these tools to read and quote get recommended; the rest are left out of the answer.",
  security: "Missing protections make it easier to hijack visitors, steal logins or inject content into your pages. Browsers also warn visitors away from sites that look unsafe, which costs trust and sales.",
  accessibility: "Many people browse with a screen reader, keyboard or zoom, and an inaccessible site turns them away. In many countries it is also a legal requirement, and the same fixes usually make the site easier for everyone.",
  domain: "A lapsed domain takes the whole site and its email offline, and anyone can buy it after. Missing email records let scammers send mail that looks like it came from you, and make your real mail more likely to land in spam.",
  privacy: "Privacy laws such as GDPR require clear policies and consent before tracking, and fines and complaints follow when they are missing. Visitors also trust sites more when they can see how their data is used.",
  speed: "These are the numbers Google uses to judge page experience, measured the way a visitor's phone or laptop actually loads the page. They show where the time goes, so you can fix the step that slows people down most.",
  pages: "Problems rarely stop at the homepage: a broken or untitled page deeper in the site loses visitors just the same. Checking many pages at once finds the issues that repeat across the site, so one fix can solve them all.",
  images: "Images are usually the heaviest part of a page, and oversized ones are the most common reason pages load slowly on phones. Shrinking a few large files is often the quickest speed win available.",
  tech: "Your domain and email records keep you reachable and stop others sending mail in your name, and an expired domain can take everything offline at once. Knowing the technology behind a site also shows what can be updated or switched on.",
  changes: "Tracking scores over time shows whether fixes are working and catches new problems early. An unexpected change to the homepage can also be the first sign that a site has been hacked.",
  monitor: "Websites break without warning: a plugin update, an expired certificate or a host outage. Regular rescans and uptime checks tell you within minutes instead of when a customer complains.",
  ai: "People increasingly ask AI assistants which business to choose, and those answers don't show a list of ten links. If you aren't mentioned, you aren't considered, so it is worth knowing where you stand.",
  compare: "Your score means more next to the sites you compete with. Seeing where competitors are ahead shows which fixes will make the biggest difference to winning visitors from them.",
  share: "A clear, branded report makes it easy to show a client what needs fixing and why. Sending it on a schedule also keeps them up to date without extra work.",
  tools: "Files such as robots.txt, llms.txt and structured data tell search engines and AI tools how to read your site, but they are easy to get wrong by hand. These generators start from what we found on this site, so the output fits it.",
};

const VERDICT = (n: number) => (n >= 80 ? "In great shape" : n >= 65 ? "In good shape" : "Room to grow");

/* Counts 0 -> target after `delay` ms. Skipped (returns target) when disabled or the user prefers reduced motion. */
function useCountUp(target: number, delay: number, duration: number, enabled: boolean) {
  const [v, setV] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now() + delay;
    let raf = 0;
    const tick = (now: number) => {
      const p = reduce ? 1 : Math.min(1, Math.max(0, (now - t0) / duration));
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration, enabled]);
  return enabled ? v : target;
}

function CountRing({ score, size, stroke, delay = 0, enabled }: { score: number; size: number; stroke: number; delay?: number; enabled: boolean }) {
  const n = useCountUp(score, delay, 1000, enabled);
  return <Ring v={score} size={size} stroke={stroke} text={String(n)} />;
}

/* Who is looking: the signed-in owner of this report, anyone else with the link (view only), or "local"
   when accounts are not switched on (local development), where everything stays editable as before.
   Ownership is decided by the database: row-level security only returns a report to its own owner. */
type Access = "checking" | "owner" | "viewer" | "local";
function useAccess(scanId: string): Access {
  const [access, setAccess] = useState<Access>(() => (supabaseBrowser() ? "checking" : "local"));
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let live = true;
    const check = async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) return live && setAccess("viewer");
      const { data: row } = await sb.from("scans").select("id").eq("id", scanId).maybeSingle();
      if (live) setAccess(row ? "owner" : "viewer");
    };
    void check();
    const { data: sub } = sb.auth.onAuthStateChange(() => void check());
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, [scanId]);
  return access;
}

/* With accounts: the owner's "marked as fixed" is saved with the report (so it follows them to any device and
   viewers see it read-only). A failed save puts the tick back and says so. */
function useServerFixed(scanId: string, saved: string[] | null | undefined) {
  const [fixed, setFixed] = useState(() => new Set<string>(saved ?? []));
  const [saveError, setSaveError] = useState("");
  const toggle = useCallback(
    async (key: string) => {
      const before = fixed;
      const next = new Set(before);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setFixed(next);
      setSaveError("");
      const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
      try {
        const r = await fetch(`/api/scan/${encodeURIComponent(scanId)}/fixed`, {
          method: "PUT",
          headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ fixed: [...next] }),
        });
        if (!r.ok) throw new Error();
      } catch {
        setFixed(before);
        setSaveError("Couldn't save that change. Please try again.");
      }
    },
    [fixed, scanId]
  );
  return { fixed, toggle, saveError };
}

/* Without accounts (local development), "marked as fixed" is remembered in this browser, per report. */
function useLocalFixed(scanId: string) {
  const storeKey = `pagelyt-fixed-${scanId}`;
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener("pagelyt-fixed", cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener("pagelyt-fixed", cb);
    };
  }, []);
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(storeKey) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]"
  );
  const fixed = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const toggle = useCallback(
    (key: string) => {
      const next = new Set(fixed);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(storeKey, JSON.stringify([...next]));
      } catch {
        /* storage blocked: change only lasts until reload */
      }
      window.dispatchEvent(new Event("pagelyt-fixed"));
    },
    [fixed, storeKey]
  );
  return { fixed, toggle };
}

/* The dashboard's sections beyond the areas: insights from the scan, and the tools that build on it. */
type Extra = "speed" | "pages" | "images" | "tech" | "changes" | "monitor" | "ai" | "compare" | "share" | "tools";
type View = "overview" | "all" | ModuleKey | Extra;
type Section = { id: Extra; label: string; icon: IconKey; text: string };

const INSIGHTS: Section[] = [
  { id: "speed", label: "Speed & vitals", icon: "performance", text: "Core Web Vitals from a real Chrome load on mobile and desktop, and what slows the page down." },
  { id: "pages", label: "Pages crawled", icon: "pages", text: "Every page we visited, with the problems found across the site rather than just the homepage." },
  { id: "images", label: "Images", icon: "images", text: "How many images the page loads, how heavy they are and which ones to shrink first." },
  { id: "tech", label: "Domain & tech", icon: "tech", text: "Domain expiry, DNS and email records, link health and the technology the site runs on." },
  { id: "changes", label: "Changes & history", icon: "history", text: "How this scan compares with earlier ones, and whether the homepage changed since last time." },
];

const GROW: Section[] = [
  { id: "monitor", label: "Save & monitor", icon: "monitor", text: "Keep this report in your account, rescan on a schedule and get uptime checks and email alerts." },
  { id: "ai", label: "AI visibility", icon: "ai", text: "See whether ChatGPT, Claude and Perplexity mention and cite this site when people ask about its field." },
  { id: "compare", label: "Compare competitors", icon: "compare", text: "Scan up to three competitors and line them up against this report, area by area." },
  { id: "share", label: "Brand & share", icon: "share", text: "Send your client a report with your logo and colours, by link or straight to their inbox." },
  { id: "tools", label: "Free tools", icon: "tools", text: "Generators for llms.txt, robots.txt, schema, search snippets and security headers, pre-filled for this site." },
];

const SECTIONS = new Map<string, Section>([...INSIGHTS, ...GROW].map((s) => [s.id, s]));
const PAID_ONLY = new Set<Extra>(["ai", "compare", "share"]);
const OWNER_ONLY = new Set<Extra>(["monitor", "ai", "compare", "share"]);
const closeMenu = (el: HTMLElement) => el.closest("details")?.removeAttribute("open");

export function Dashboard({ scan, history, savedFixed, shots, canEmail }: { scan: StoredScan; history?: Snap[]; savedFixed?: string[] | null; shots?: { now: string | null; prev: string | null }; canEmail?: boolean }) {
  const params = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [intro, setIntro] = useState(true); // staged reveal on first open only
  const access = useAccess(scan.id);
  const canEdit = access === "owner" || access === "local";
  const local = useLocalFixed(scan.id);
  const server = useServerFixed(scan.id, savedFixed);
  const { fixed, toggle } = access === "local" ? local : server;
  const saveError = access === "local" ? "" : server.saveError;
  const { prev, trend, synced, points } = useHistory(scan, history);
  const [acct, setAcct] = useAccount(access === "owner");
  // The signed-in owner sees their own name up top; anyone else with the link only ever sees the website.
  const me = useSignedInUser();
  const ownerName = access === "owner" && me ? me.name : null;
  const [pinned, setPinned] = useState(false);
  const [party, setParty] = useState(false);
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const siteId = useSiteId(scan.host, access === "owner");

  // Show the compact score bar once the hero has scrolled out of view.
  const watchHero = useCallback((el: HTMLElement | null) => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setIntro(false), 5000);
    return () => window.clearTimeout(t);
  }, []);

  // A click anywhere else closes an open header menu.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      document.querySelectorAll<HTMLDetailsElement>(".dash-top details.xmenu[open]").forEach((d) => {
        if (!d.contains(e.target as Node)) d.removeAttribute("open");
      });
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const keyed = useMemo(() => scan.findings.map((f) => ({ f, k: findingKey(f) })), [scan.findings]);
  const fixedCount = keyed.filter((x) => fixed.has(x.k)).length;
  const remaining = useMemo(() => keyed.filter((x) => !fixed.has(x.k)).map((x) => x.f), [keyed, fixed]);

  // Scores if every finding marked as fixed were really fixed.
  const modules = useMemo(() => scoreModules(remaining), [remaining]);
  const potential = overallScore(modules);
  const gain = potential - scan.overall;
  const pct = scan.findings.length ? Math.round((fixedCount / scan.findings.length) * 100) : 100;

  const high = remaining.filter((f) => f.severity === "high").length;

  // Overall points each open finding is worth, and the headline win if the important ones are fixed.
  const gains = useMemo(() => {
    const base = overallScore(scoreModules(remaining));
    const m = new Map<string, number>();
    for (const f of remaining) m.set(findingKey(f), overallScore(scoreModules(remaining.filter((x) => x !== f))) - base);
    return m;
  }, [remaining]);
  const highGain = useMemo(() => overallScore(scoreModules(remaining.filter((f) => f.severity !== "high"))) - potential, [remaining, potential]);
  const topArea = useMemo(() => [...modules].sort((a, b) => a.score - b.score)[0], [modules]);

  // The sections this visitor can open, in sidebar order (which is also the Previous / Next order).
  const owner = canEdit; // the owner, or local development
  const grow = useMemo(() => GROW.filter((g) => owner || !OWNER_ONLY.has(g.id)), [owner]);
  const order: View[] = useMemo(() => ["overview", "all", ...modules.map((m) => m.key), ...INSIGHTS.map((s) => s.id), ...grow.map((s) => s.id)], [modules, grow]);

  // The open section lives in the address (?view=seo), so Back, refresh and shared links all land on it.
  const asked = params.get("view") ?? "overview";
  const view: View = order.includes(asked as View) ? (asked as View) : "overview";
  const setView = useCallback((v: View) => {
    const q = new URLSearchParams(window.location.search);
    if (v === "overview") q.delete("view");
    else q.set("view", v);
    const s = q.toString();
    window.history.pushState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
    window.scrollTo({ top: 0 });
  }, []);
  const labelOf = (v: View) => (v === "overview" ? "Overview" : v === "all" ? "All findings" : v in MODULE_NAMES ? MODULE_NAMES[v as ModuleKey] : SECTIONS.get(v)!.label);
  const at = order.indexOf(view);
  const prevView = at > 0 ? order[at - 1] : null;
  const nextView = at < order.length - 1 ? order[at + 1] : null;
  const groupOf = (v: View) => (v === "all" ? "Findings" : v in MODULE_NAMES ? "Areas" : INSIGHTS.some((s) => s.id === v) ? "Insights" : "Grow");

  const onToggle = (key: string) => {
    if (!canEdit) return; // viewers cannot change a report
    const f = scan.findings.find((x) => findingKey(x) === key);
    if (f?.severity === "high" && !fixed.has(key) && high === 1) {
      setParty(true);
      window.setTimeout(() => setParty(false), 3600);
    }
    toggle(key);
  };

  useShortcuts({ openPalette: () => setPalette(true), openHelp: () => setHelp(true), views: order, setView: (v) => setView(v as View), toggleKey: onToggle });

  const cmds: Cmd[] = [
    { id: "v-overview", label: "Overview", group: "Go to", icon: "health", run: () => setView("overview") },
    { id: "v-all", label: "All findings", group: "Go to", icon: "seo", run: () => setView("all") },
    ...modules.map((m): Cmd => ({ id: "v-" + m.key, label: m.name, hint: String(m.score), group: "Go to", icon: m.key, run: () => setView(m.key) })),
    ...[...INSIGHTS, ...grow].map((s): Cmd => ({ id: "v-" + s.id, label: s.label, group: "Go to", run: () => setView(s.id) })),
    { id: "a-print", label: "Print or save as PDF", group: "Actions", run: () => window.print() },
    { id: "a-help", label: "Keyboard shortcuts", group: "Actions", run: () => setHelp(true) },
    { id: "a-new", label: "Scan another site", group: "Actions", run: () => router.push("/") },
    ...remaining.slice(0, 40).map((f): Cmd => ({ id: "f-" + findingKey(f), label: f.title, hint: MODULE_NAMES[f.module], group: "Findings", icon: f.module, run: () => setView(f.module) })),
  ];
  const when = new Date(scan.scannedAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  const countOf = (k: ModuleKey) => remaining.filter((f) => f.module === k).length;
  const isArea = view in MODULE_NAMES;
  const inModule = isArea ? scan.findings.filter((f) => f.module === view) : [];
  const mod = isArea ? modules.find((m) => m.key === view)! : null;
  const section = SECTIONS.get(view) ?? null;
  const toolCtx = view === "tools" ? toolContext(scan.id, scan) : null;
  const needsPlan = (id: Extra) => PAID_ONLY.has(id) && access === "owner" && !!acct && !acct.paid;

  const [pdfBusy, setPdfBusy] = useState(false);
  // Paid owners get the server-rendered branded PDF; everyone else (and any failure) uses print-to-PDF.
  const pdf = async () => {
    if (access !== "owner" || !acct?.paid) return window.print();
    setPdfBusy(true);
    const t = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
    await downloadPdf({ scanId: scan.id }, t);
    setPdfBusy(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the URL is still in the address bar */
    }
  };
  const shareOut = (kind: "mail" | "wa") => {
    const msg = encodeURIComponent(`Website report for ${scan.host}: ${scan.overall}/100`);
    const href = encodeURIComponent(`${window.location.origin}${window.location.pathname}`);
    if (kind === "mail") window.location.href = `mailto:?subject=${msg}&body=${href}`;
    else window.open(`https://wa.me/?text=${msg}%20${href}`, "_blank", "noopener,noreferrer");
  };
  const go = (v: View) => (e: React.MouseEvent<HTMLElement>) => {
    closeMenu(e.currentTarget);
    setView(v);
  };

  const navBtn = (v: View, icon: IconKey, label: string, badge?: React.ReactNode) => (
    <button key={v} type="button" aria-current={view === v} onClick={() => setView(v)}>
      <span className="nv"><AreaIcon k={icon} />{label}</span>
      {badge}
    </button>
  );

  const hero = (s: Section, extra?: React.ReactNode) => (
    <section className="dash-hero sec-hero" aria-label={s.label}>
      <span className="sec-ico"><AreaIcon k={s.icon} size={28} /></span>
      <div className="dash-hero-txt">
        <p className="dash-eyebrow">{groupOf(s.id)}{needsPlan(s.id) && <span className="plan-badge">Paid plans</span>}</p>
        <h1>{s.label}</h1>
        <p>{s.text}</p>
        <p className="sec-why"><b>Why it matters:</b> {WHY[s.id]}</p>
        {extra}
      </div>
    </section>
  );
  const empty = (text: string) => <p className="panel sec-empty">{text}</p>;
  const signInNote = (
    <p className="panel sec-empty">
      Only the report&rsquo;s owner can use this. <Link className="fnd-link" href={`/login?next=${encodeURIComponent(`/dashboard/${scan.id}`)}`}>Sign in as the owner</Link>
    </p>
  );

  let body: React.ReactNode;
  if (view === "all") {
    body = (
      <>
        <section className="dash-hero" aria-label="All findings">
          <div className="dash-hero-txt">
            <p className="dash-eyebrow">Everything we found</p>
            <h1>All findings</h1>
            <p>Search, filter by priority and tick things off as you fix them.</p>
          </div>
        </section>
        <FindingsExplorer findings={scan.findings} fixed={fixed} onToggleFixed={canEdit ? onToggle : undefined} gains={gains} />
      </>
    );
  } else if (view === "overview") {
    body = (
      <>
        <section className="dash-hero" aria-label="Overall score" ref={watchHero}>
          <CountRing score={potential} size={132} stroke={13} enabled={intro} />
          <div className="dash-hero-txt">
            <p className="dash-eyebrow">Website Intelligence Score</p>
            <h1>{VERDICT(potential)}</h1>
            <p aria-live="polite">
              {scan.findings.length === 0
                ? "No issues found. Nice work."
                : remaining.length === 0
                  ? "Every finding is marked as fixed. Rescan to confirm."
                  : `${remaining.length} open finding${remaining.length === 1 ? "" : "s"}${high ? `, ${high} high priority` : ""}. Start at the top: the list is ordered by importance.`}
            </p>
            {remaining.length > 0 && (
              <p className="dash-story">
                {high > 0 ? (
                  <>Fix the {high} important item{high === 1 ? "" : "s"} first: <b>+{highGain} points</b>. </>
                ) : (
                  <>No urgent problems. </>
                )}
                Weakest area: <button type="button" className="fnd-link" onClick={() => setView(topArea.key)}>{topArea.name}</button> ({topArea.score}).
              </p>
            )}
            {scan.findings.length > 0 && (
              <div className="dash-progress">
                <div className="dp-bar" role="progressbar" aria-label="Findings marked as fixed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <i style={{ width: `${pct}%` }} />
                </div>
                <span>
                  {fixedCount} of {scan.findings.length} fixed
                  {gain > 0 && <b className="dp-gain"> · +{gain} points</b>}
                </span>
              </div>
            )}
          </div>
        </section>

        <ul className="dash-cards" aria-label="Scores by area">
          {modules.map((m, i) => (
            <li key={m.key} style={{ ["--i" as string]: i }}>
              <button type="button" className={`dc-${tone(m.score)}`} onClick={() => setView(m.key)}>
                <CountRing score={m.score} size={64} stroke={7} delay={700 + i * 150} enabled={intro} />
                <span className="dc-name"><AreaIcon k={m.key} size={16} />{m.name}</span>
                <Heat list={remaining.filter((f) => f.module === m.key)} />
                <span className="dc-n">
                  {countOf(m.key) === 0 ? "No open issues" : `${countOf(m.key)} open issue${countOf(m.key) === 1 ? "" : "s"}`}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {remaining.length > 0 && (
          <Findings findings={remaining.slice(0, 5)} title="Top fixes" fixed={fixed} onToggleFixed={canEdit ? onToggle : undefined} gains={gains} />
        )}
        <QuickWins findings={remaining} gains={gains} onOpen={(f) => setView(f.module)} />
        {remaining.length > 5 && (
          <p className="dash-more">
            Showing the 5 most important of {remaining.length} open findings. Choose an area on the left, or{" "}
            <button type="button" className="fnd-link" onClick={() => setView("all")}>
              see all findings
            </button>
            .
          </p>
        )}

        <section className="do-more" aria-labelledby="do-more-h">
          <h2 id="do-more-h">Do more with this report</h2>
          <ul>
            {grow.map((g) => (
              <li key={g.id}>
                <button type="button" onClick={() => setView(g.id)}>
                  <span className="dm-ico"><AreaIcon k={g.icon} size={22} /></span>
                  <b>{g.label}{needsPlan(g.id) && <span className="plan-badge">Paid plans</span>}</b>
                  <span>{g.text}</span>
                  <span className="dm-go" aria-hidden="true">Open →</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="panel-grid">
          <RadarPanel modules={modules} />
          <ComparePanel scan={scan} prev={prev} trend={trend} synced={synced} points={points} />
        </div>
        <ul className="insight-links" aria-label="More from this scan">
          {INSIGHTS.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setView(s.id)}>
                <AreaIcon k={s.icon} size={18} />
                {s.label} <span aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ul>
        <HowScores />
      </>
    );
  } else if (mod) {
    const area = mod.key;
    body = (
      <>
        <section className="dash-hero" aria-label={`${mod.name} score`}>
          <CountRing score={mod.score} size={104} stroke={11} enabled={intro} />
          <div className="dash-hero-txt">
            <p className="dash-eyebrow">{MODULE_NAMES[area]}</p>
            <h1>{mod.score >= 80 ? "Looking good" : mod.score >= 50 ? "Needs work" : "Needs attention"}</h1>
            <p>{BLURB[area]}</p>
            <p className="sec-why"><b>Why it matters:</b> {WHY[area]}</p>
            <p className="dash-sub">
              {inModule.length === 0
                ? "No issues found in this area."
                : countOf(area) === 0
                  ? "Everything here is marked as fixed."
                  : `${countOf(area)} of ${inModule.length} issue${inModule.length === 1 ? "" : "s"} still to look at.`}
            </p>
          </div>
        </section>
        {inModule.length > 0 && <Findings findings={inModule} fixed={fixed} onToggleFixed={canEdit ? onToggle : undefined} gains={gains} grouped />}
      </>
    );
  } else if (section) {
    const s = section;
    let content: React.ReactNode = null;
    if (s.id === "speed") content = scan.vitals ? <VitalsPanel vitals={scan.vitals} /> : empty("Speed wasn't measured in this scan. Rescan to try again.");
    else if (s.id === "pages")
      // The crawl table needs at least two pages; a one-page crawl found no other pages to visit.
      content = (scan.crawl?.list.length ?? 0) >= 2 ? <CrawlPanel crawl={scan.crawl} /> : empty(scan.crawl ? "We couldn't find any pages beyond the homepage to crawl. Add a sitemap or link to your main pages from the homepage." : "Only the homepage was checked in this scan, so there is no site-wide crawl to show.");
    else if (s.id === "images") content = scan.images ? <ImagesPanel images={scan.images} weight={scan.vitals?.weight} /> : empty("No images were checked in this scan.");
    else if (s.id === "tech")
      content = !scan.domain && !scan.tech ? empty("Domain and technology details weren't available for this scan. Rescan to try again.") : (
        <div className="panel-grid">
          <DomainPanel domain={scan.domain} links={scan.links} at={scan.scannedAt} />
          <TechPanel tech={scan.tech} />
        </div>
      );
    else if (s.id === "changes")
      content = (
        <>
          <ComparePanel scan={scan} prev={prev} trend={trend} synced={synced} points={points} />
          {scan.change ? <ChangePanel scan={scan} shots={shots} /> : empty("This is the first scan we have of this site, so there is nothing to compare the homepage with yet. Rescan later to see what changed.")}
        </>
      );
    else if (s.id === "tools") content = toolCtx && <Tools ctx={toolCtx} embedded />;
    else if (!owner) content = signInNote;
    else if (s.id === "monitor") content = access === "local" ? empty("Saving sites needs accounts, which aren't switched on here.") : <SaveSite scanId={scan.id} inline />;
    else if (s.id === "ai")
      content = (
        <div className="panel sec-cta">
          {siteId ? (
            <>
              <p>Weekly checks of what AI assistants say about {scan.host}, with the prompts you choose.</p>
              <Link className="dash-btn primary" href={`/account/visibility/${siteId}`}>Open AI visibility for {scan.host}</Link>
            </>
          ) : (
            <>
              <p>AI visibility runs on saved sites. Save {scan.host} first, then come back here.</p>
              <button type="button" className="dash-btn primary" onClick={() => setView("monitor")}>Save this site</button>
            </>
          )}
          {needsPlan("ai") && <p className="panel-note">AI visibility checks come with the Professional and Business plans. <Link className="fnd-link" href={AGENCY_UPSELL}>Talk to us about a plan</Link></p>}
        </div>
      );
    else if (s.id === "compare")
      content = (
        <div className="panel sec-cta">
          <p>Each competitor is scanned like any other site (about a minute each) and counts towards your scan limit.</p>
          {access === "owner" ? <CompareButton scanId={scan.id} host={scan.host} paid={!!acct?.paid} /> : empty("Comparisons need accounts, which aren't switched on here.")}
        </div>
      );
    else if (s.id === "share")
      content = (
        <div className="panel sec-cta">
          <p>Your client sees your logo, colours and contact details, and nothing of Pagelyt. Set up your brand once, then share any report in a click.</p>
          <div className="sec-row">
            {access === "owner" && <ShareReport scanId={scan.id} host={scan.host} score={scan.overall} canEmail={!!canEmail} />}
            <Link className="dash-btn" href="/account/brand">Brand settings</Link>
            <Link className="dash-btn" href="/r/demo">See a sample</Link>
          </div>
        </div>
      );
    body = (
      <>
        {hero(s)}
        {content}
      </>
    );
  }

  return (
    <div className={`dash${intro ? " intro" : ""}`}>
      <CommandPalette open={palette} onClose={() => setPalette(false)} cmds={cmds} />
      <ShortcutHelp open={help} onClose={() => setHelp(false)} />
      <PrintCover scan={scan} overall={potential} modules={modules} preparedFor={ownerName} />
      {party && <Confetti />}
      {access === "owner" && acct && acct.accountType === null && <AgencyModal onAnswered={setAcct} />}
      <div className={`dash-pin${pinned && view === "overview" ? " on" : ""}`} aria-hidden={!pinned}>
        <b className={`t-${tone(potential)}`}>{potential}</b>
        <span>{scan.host} · {VERDICT(potential)}</span>
        <span className="dash-pin-n">{remaining.length} open · {fixedCount} fixed</span>
      </div>
      <header className="dash-top">
        <Link href="/" className="dash-logo" aria-label="Pagelyt home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Pagelyt" width={140} height={30} />
        </Link>
        <div className="dash-site">
          {ownerName ? (
            <>
              <strong className="dash-hi">Hi, {firstName(ownerName)}</strong>
              <span>{scan.host} · Scanned {when} UTC</span>
            </>
          ) : (
            <>
              <strong>{scan.host}</strong>
              <span>Scanned {when} UTC</span>
            </>
          )}
        </div>
        <div className="dash-act">
          <button type="button" className="dash-btn kbd-btn" onClick={() => setPalette(true)} aria-label="Search and jump (Ctrl K)">
            Search <kbd>Ctrl K</kbd>
          </button>
          {access === "owner" && <RescanButton url={scan.url} />}
          <details className="xmenu">
            <summary className="dash-btn">{copied ? "Link copied" : "Share"} <span className="caret" aria-hidden="true">▾</span></summary>
            <div className="xmenu-pop" role="menu">
              <button type="button" role="menuitem" onClick={(e) => { closeMenu(e.currentTarget); void copy(); }}>Copy link</button>
              {owner && <button type="button" role="menuitem" onClick={go("share")}>Branded report for a client…</button>}
              <hr />
              <button type="button" role="menuitem" onClick={(e) => { closeMenu(e.currentTarget); shareOut("mail"); }}>Share by email</button>
              <button type="button" role="menuitem" onClick={(e) => { closeMenu(e.currentTarget); shareOut("wa"); }}>Share on WhatsApp</button>
            </div>
          </details>
          <ExportMenu scan={scan} findings={scan.findings} fixed={fixed} pdfLabel={pdfBusy ? "Preparing PDF…" : access === "owner" && acct?.paid ? "Download PDF" : "Print / save as PDF"} onPdf={() => void pdf()} />
          <details className="xmenu">
            <summary className="dash-btn">More <span className="caret" aria-hidden="true">▾</span></summary>
            <div className="xmenu-pop" role="menu">
              {grow.map((g) => (
                <button key={g.id} type="button" role="menuitem" onClick={go(g.id)}>{g.label}</button>
              ))}
              <hr />
              <button type="button" role="menuitem" onClick={(e) => { closeMenu(e.currentTarget); setHelp(true); }}>Keyboard shortcuts</button>
            </div>
          </details>
          <Link href="/" className="dash-btn primary">
            Scan another site
          </Link>
        </div>
        <AuthLink compact />
      </header>

      {access === "viewer" && (
        <p className="dash-viewonly" role="status">
          <b>View only.</b> You&rsquo;re looking at a shared report. The owner can sign in to tick findings off, rescan and save the site.{" "}
          <Link href={`/login?next=${encodeURIComponent(`/dashboard/${scan.id}`)}`}>Sign in as the owner</Link>
        </p>
      )}
      {saveError && <p className="dash-viewonly bad" role="alert">{saveError}</p>}

      <div className="dash-body">
        <nav className="dash-nav" aria-label="Report sections">
          {navBtn("overview", "overview", "Overview", <b>{remaining.length}</b>)}
          <p className="nav-h">Findings</p>
          {navBtn("all", "list", "All findings", <b>{scan.findings.length}</b>)}
          <p className="nav-h">Areas</p>
          {modules.map((m) => navBtn(m.key, m.key, m.name, <b className={`t-${tone(m.score)}`}>{m.score}</b>))}
          <p className="nav-h">Insights</p>
          {INSIGHTS.map((s) => navBtn(s.id, s.icon, s.label))}
          <p className="nav-h">Grow</p>
          {grow.map((s) => navBtn(s.id, s.icon, s.label, needsPlan(s.id) ? <span className="plan-dot" title="Paid plans">Paid</span> : undefined))}
        </nav>

        <main className="dash-main">
          {view !== "overview" && (
            <div className="dash-back">
              <button type="button" className="back-btn" onClick={() => setView("overview")}>
                <span aria-hidden="true">←</span> Back to overview
              </button>
              <span className="dash-crumb">{groupOf(view)} <span aria-hidden="true">›</span> {labelOf(view)}</span>
            </div>
          )}
          {body}
          <nav className="dash-pn" aria-label="Previous and next section">
            {prevView ? (
              <button type="button" onClick={() => setView(prevView)}>
                <small>← Previous</small>
                {labelOf(prevView)}
              </button>
            ) : <span />}
            {nextView && (
              <button type="button" className="next" onClick={() => setView(nextView)}>
                <small>Next →</small>
                {labelOf(nextView)}
              </button>
            )}
          </nav>
        </main>
      </div>
    </div>
  );
}

/* The saved site (if any) behind this report, for links that need it (AI visibility). Owner only, via RLS. */
function useSiteId(host: string, enabled: boolean) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!enabled || !sb) return;
    let live = true;
    void sb
      .from("sites")
      .select("id")
      .eq("host", host)
      .limit(1)
      .then(({ data }) => {
        if (live) setId((data as { id: string }[] | null)?.[0]?.id ?? null);
      });
    return () => {
      live = false;
    };
  }, [host, enabled]);
  return id;
}

/* Tiny stacked bar: how many important / worth-fixing / minor items are still open in an area. */
function Heat({ list }: { list: { severity: "high" | "medium" | "low" }[] }) {
  const n = (s: string) => list.filter((f) => f.severity === s).length;
  if (!list.length) return <span className="heat none" aria-hidden="true" />;
  return (
    <span className="heat" aria-hidden="true">
      <i className="h-high" style={{ flex: n("high") }} />
      <i className="h-medium" style={{ flex: n("medium") }} />
      <i className="h-low" style={{ flex: n("low") }} />
    </span>
  );
}

function Confetti() {
  return (
    <div className="confetti" role="status">
      <p>All important issues fixed. Nice work!</p>
      {Array.from({ length: 24 }, (_, i) => (
        <i key={i} style={{ ["--x" as string]: `${(i * 37) % 100}%`, ["--d" as string]: `${(i % 6) * 90}ms`, ["--h" as string]: String((i * 47) % 360) }} />
      ))}
    </div>
  );
}

/* Only visible when printing: a branded first page. */
function PrintCover({ scan, overall, modules, preparedFor }: { scan: StoredScan; overall: number; modules: { key: string; name: string; score: number }[]; preparedFor: string | null }) {
  const when = new Date(scan.scannedAt).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" });
  return (
    <section className="print-cover" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={180} height={38} />
      <p className="pc-kicker">Website Intelligence Report</p>
      <h1>{scan.host}</h1>
      {preparedFor && <p className="pc-for">Prepared for {preparedFor}</p>}
      <p className="pc-date">Scanned {when}</p>
      <div className="pc-score"><b>{overall}</b><span>/ 100</span></div>
      <ul>
        {modules.map((m) => (
          <li key={m.key}><span>{m.name}</span><b>{m.score}</b></li>
        ))}
      </ul>
      <p className="pc-foot">{scan.findings.length} findings · Automated checks, not a compliance certificate · pagelyt.dev</p>
    </section>
  );
}
