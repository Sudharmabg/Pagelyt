"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Findings } from "../findings";
import { Ring, tone } from "../ui";
import { findingKey, overallScore, scoreModules } from "@/lib/scan/score";
import { MODULE_NAMES, type Finding, type ModuleKey } from "@/lib/scan/types";
import { AreaIcon, type IconKey } from "./icons";
import { SaveSite } from "./save-site";
import { BrandShare } from "./brand-share";
import { RescanButton } from "./rescan";
import { ActionModal, Tile } from "./action-modal";
import { AGENCY_UPSELL, AgencyModal, useAccount } from "./agency-modal";
import { Assistant } from "./assistant";
import { GoogleData, type GoogleTab } from "./google-data";
import { AiOverviewCard } from "./analytics-data";
import { useGoogle } from "./use-google";
import { byTraffic, trafficMap } from "@/lib/google/gsc-insights";
import { visitsMap } from "@/lib/google/ga4-insights";
import { Visibility } from "../account/visibility/[siteId]/visibility";
import { CompareButton } from "./compare-button";
import { downloadPdf, fullReportPrintUrl } from "@/lib/download-pdf";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { firstName, useSignedInUser } from "@/lib/use-signed-in";
import { AuthLink } from "../auth-link";
import { CommandPalette, ShortcutHelp, useShortcuts, type Cmd } from "./extras";
import { ComparePanel, DomainPanel, ExportTiles, FindingsExplorer, CrawlPanel, CrawlWhyPanel, ChangePanel, HowScores, ImagesPanel, QuickWins, TechPanel, VitalsPanel, useHistory, type Snap } from "./panels";
import type { StoredScan } from "@/lib/scan/store";
import { toolContext } from "@/lib/scan/tools-context";
import { DashTool, DashToolGrid, fixableCount, toolsByNeed } from "../tools/dash-tools";
import { TOOL_LIST, TOOLS_BY_SLUG, type ToolInfo, type ToolSlug } from "../tools/catalog";
import { TONE, ToolIcon } from "../tools/icons";

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
  assistant: "Reports list what is wrong; knowing what to do next is the hard part. Asking in plain words gets you steps for your own site, drawn from the same guides our checks are built on.",
  google: "A report says what is wrong; Search Console says how many real searchers it affects. Fixing the issues on the pages Google already sends people to pays off first, and the searches just off page one are the cheapest traffic to win.",
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

/* The dashboard's sections beyond the areas: the star features, the tools, and details from the scan (opened from
   their Overview cards, not the sidebar).
   Each tool is a view of its own (?view=<tool slug>); "tools" is the grid of all of them. */
type Extra = "speed" | "pages" | "images" | "tech" | "changes" | "assistant" | "monitor" | "google" | "ai" | "compare" | "share" | "tools";
type View = "overview" | "all" | ModuleKey | Extra | ToolSlug;
const isTool = (v: string): v is ToolSlug => TOOLS_BY_SLUG.has(v as ToolSlug);
type Section = { id: Extra; label: string; icon: IconKey; text: string };

const INSIGHTS: Section[] = [
  { id: "speed", label: "Speed & vitals", icon: "performance", text: "Core Web Vitals from a real Chrome load on mobile and desktop, and what slows the page down." },
  { id: "pages", label: "Pages crawled", icon: "pages", text: "Every page we visited, with the problems found across the site rather than just the homepage." },
  { id: "images", label: "Images", icon: "images", text: "How many images the page loads, how heavy they are and which ones to shrink first." },
  { id: "tech", label: "Domain & tech", icon: "tech", text: "Domain expiry, DNS and email records, link health and the technology the site runs on." },
  { id: "changes", label: "Changes & history", icon: "history", text: "How this scan compares with earlier ones, and whether the homepage changed since last time." },
];

/* Pagelyt's star features: highlighted in the sidebar and as the strip under the score on Overview. */
const STAR: Section[] = [
  { id: "assistant", label: "Ask Pagelyt", icon: "chat", text: "Ask anything about improving this site. Answers come from this report, our fix guides and our blog." },
  { id: "monitor", label: "Save & monitor", icon: "monitor", text: "Keep this report in your account, rescan on a schedule and get uptime checks and email alerts." },
  { id: "google", label: "Google data", icon: "google", text: "Connect Search Console and Analytics to see the real clicks and visitors behind each issue, pages losing traffic and AI insights from your numbers." },
  { id: "ai", label: "AI visibility", icon: "ai", text: "See whether ChatGPT mentions and cites this site when people ask about its field." },
  { id: "compare", label: "Compare competitors", icon: "compare", text: "Scan up to three competitors and line them up against this report, area by area." },
  { id: "share", label: "Brand & share", icon: "share", text: "Send your client a report with your logo and colours, by link or straight to their inbox." },
];
const ALL_TOOLS: Section = { id: "tools", label: "All tools", icon: "tools", text: `All ${TOOL_LIST.length} free checkers and generators, pre-filled for this site. The ones that fix this scan's findings come first.` };

/** Tools listed in the sidebar; the rest are under "More tools". */
const MAIN_TOOLS = 5;

const SECTIONS = new Map<string, Section>([...INSIGHTS, ...STAR, ALL_TOOLS].map((s) => [s.id, s]));
const PAID_ONLY = new Set<Extra>(["google", "ai", "compare", "share"]);
const OWNER_ONLY = new Set<Extra>(["assistant", "monitor", "google", "ai", "compare", "share"]);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* "Do more" rows written for this report: a headline from its own numbers, a short line, a verb for the button,
   and how relevant it is right now (most relevant first). */
type Pitch = { hook: string; text: string; cta: string; weight: number };
function pitchFor(id: Extra, r: { open: Finding[]; high: number; overall: number; modules: { key: ModuleKey; score: number }[]; saved: boolean; prev: boolean; gscClicks: number | null }): Pitch {
  const score = (k: ModuleKey) => r.modules.find((m) => m.key === k)?.score ?? 100;
  switch (id) {
    case "assistant":
      return { hook: r.high ? `${plural(r.high, "important issue")}, explained` : "Questions about this report?", text: "Ask what to fix first and how.", cta: "Ask Pagelyt", weight: r.high ? 3.5 : 2 };
    case "monitor":
      if (r.saved) return { hook: "This site is saved", text: "Pick a rescan schedule and alerts.", cta: "Set alerts", weight: 1 };
      if (r.high) return { hook: `${plural(r.high, "important issue")} to fix`, text: "Rescan weekly to confirm each fix lands.", cta: "Save & monitor", weight: 4 };
      return { hook: r.prev ? "Stop rescanning by hand" : "Know the moment something breaks", text: "Scheduled rescans, uptime checks, email alerts.", cta: "Save & monitor", weight: 3 };
    case "google":
      if (r.gscClicks != null) return { hook: `${r.gscClicks.toLocaleString("en-GB")} Google clicks in 28 days`, text: "See which issues touch the most traffic.", cta: "Open Google data", weight: 3 };
      return { hook: "Which issues cost you traffic?", text: "Connect Search Console for real clicks per issue.", cta: "Connect Google", weight: r.open.length ? 2.5 : 1 };
    case "ai": {
      const g = score("geo");
      return { hook: `AI readiness is ${g}/100`, text: g < 80 ? "Find out if ChatGPT mentions you." : "See whether ChatGPT cites you.", cta: "Check AI answers", weight: g < 80 ? (80 - g) / 10 + 1 : 1.5 };
    }
    case "compare":
      return { hook: `You score ${r.overall}. How do rivals do?`, text: "Line up three competitors, area by area.", cta: "Compare now", weight: 2 };
    case "share":
      return { hook: r.open.length ? `${plural(r.open.length, "open finding")} to hand over` : "A clean report to show off", text: "Your logo, by link or straight to their inbox.", cta: "Send report", weight: 1 };
    default:
      return { hook: "", text: "", cta: "Open", weight: 0 };
  }
}

/* The key numbers of each insight section, for its Overview card and the stat row in its header. */
type Stat = { value: string; label: string; tone?: "good" | "ok" | "bad" };
const mb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`);
const scoreTone = (n: number): Stat["tone"] => (n >= 80 ? "good" : n >= 50 ? "ok" : "bad");
function sectionStats(id: Extra, scan: StoredScan, prev: Snap | null, scans: number): Stat[] {
  const out: Stat[] = [];
  if (id === "speed") {
    const v = scan.vitals;
    if (v?.mobile?.score != null) out.push({ value: String(v.mobile.score), label: "phone speed score", tone: scoreTone(v.mobile.score) });
    if (v?.mobile?.lcp != null) out.push({ value: `${(v.mobile.lcp / 1000).toFixed(1)} s`, label: "until the main content shows on a phone", tone: v.mobile.lcp <= 2500 ? "good" : v.mobile.lcp <= 4000 ? "ok" : "bad" });
    if (v?.desktop?.score != null) out.push({ value: String(v.desktop.score), label: "desktop speed score", tone: scoreTone(v.desktop.score) });
  } else if (id === "pages") {
    const c = scan.crawl;
    if (c) {
      out.push({ value: String(c.pages), label: c.pages === 1 ? "page crawled" : "pages crawled" });
      out.push({ value: String(c.broken), label: c.broken === 1 ? "broken page" : "broken pages", tone: c.broken ? "bad" : "good" });
      if (c.sitemapUrls) out.push({ value: String(c.sitemapUrls), label: "addresses in the sitemap" });
    }
  } else if (id === "images") {
    const im = scan.images;
    if (im) {
      const big = im.probed.filter((p) => (p.bytes ?? 0) > 300_000).length;
      out.push({ value: String(im.count), label: im.pages && im.pages > 1 ? `images across ${im.pages} pages` : "images found" });
      out.push({ value: String(big), label: big === 1 ? "image over 300 KB" : "images over 300 KB", tone: big ? "bad" : "good" });
    }
    if (scan.vitals?.weight?.images != null) out.push({ value: mb(scan.vitals.weight.images), label: "of images on the homepage", tone: scan.vitals.weight.images > 1_500_000 ? "bad" : scan.vitals.weight.images > 700_000 ? "ok" : "good" });
  } else if (id === "tech") {
    const exp = scan.domain?.expires ? Math.round((Date.parse(scan.domain.expires) - Date.parse(scan.scannedAt)) / 86_400_000) : null;
    if (exp != null && Number.isFinite(exp)) out.push({ value: String(exp), label: exp === 1 ? "day until the domain expires" : "days until the domain expires", tone: exp < 30 ? "bad" : exp < 90 ? "ok" : "good" });
    if (scan.links) out.push({ value: String(scan.links.broken), label: `broken of ${scan.links.checked} links checked`, tone: scan.links.broken ? "bad" : "good" });
    if (scan.tech?.length) out.push({ value: String(scan.tech.length), label: "technologies spotted" });
  } else if (id === "changes") {
    if (prev) {
      const d = scan.overall - prev.overall;
      out.push({ value: d > 0 ? `+${d}` : String(d), label: "points since the last scan", tone: d > 0 ? "good" : d < 0 ? "bad" : undefined });
    } else out.push({ value: "1st", label: "scan of this site" });
    if (scan.change?.visual != null) out.push({ value: `${scan.change.visual}%`, label: "of the homepage looks different", tone: scan.change.visual > 40 ? "ok" : undefined });
    if (scans > 1) out.push({ value: String(scans), label: "scans on record" });
  }
  return out;
}

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
  const [chat, setChat] = useState(false); // the small Ask Pagelyt widget, bottom right
  const siteId = useSiteId(scan.host, access === "owner");
  const google = useGoogle(siteId, access === "owner");
  const [gTab, setGTab] = useState<GoogleTab>(() => (params.get("gtab") === "analytics" ? "ga4" : "gsc"));

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

  // Share, Export and More open as modals; the browser's share sheet is offered where it exists (phones).
  const [modal, setModal] = useState<null | "share" | "export" | "more">(null);
  const [canShare, setCanShare] = useState(false);
  const [reportUrl, setReportUrl] = useState(""); // read when the modal opens (there is no window on the server)
  const openShare = () => {
    setCanShare("share" in navigator);
    setReportUrl(`${window.location.origin}${window.location.pathname}`);
    setModal("share");
  };

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
  // Real Google traffic per open finding, once Search Console is connected for this site.
  const gsc = google.gsc;
  const traffic = useMemo(() => (gsc ? trafficMap(remaining, gsc, scan.url, findingKey) : undefined), [gsc, remaining, scan.url]);
  // Google Analytics visits per open finding, once Analytics is connected.
  const ga4 = google.ga4;
  const visits = useMemo(() => (ga4 ? visitsMap(remaining, ga4, findingKey) : undefined), [ga4, remaining]);
  const topFixes = useMemo(() => (traffic ? byTraffic(remaining, traffic, findingKey) : remaining).slice(0, 5), [remaining, traffic]);
  const topArea = useMemo(() => [...modules].sort((a, b) => a.score - b.score)[0], [modules]);

  // The sections this visitor can open, in sidebar order (also the order the ← / → keys step through). Tools past the
  // main five, the scan details and the areas are not in the sidebar: they open from "More tools", the Overview
  // cards and search, so they come last.
  const owner = canEdit; // the owner, or local development
  const star = useMemo(() => STAR.filter((g) => owner || !OWNER_ONLY.has(g.id)), [owner]);
  const tools = useMemo(() => toolsByNeed(remaining), [remaining]);
  // The sidebar lists the five tools with the most to fix for this scan; "More tools" opens all of them.
  const mainTools = tools.slice(0, MAIN_TOOLS);
  const order: View[] = useMemo(
    () => ["overview", "all", ...star.map((s) => s.id), ...tools.slice(0, MAIN_TOOLS).map((x) => x.t.slug), "tools", ...tools.slice(MAIN_TOOLS).map((x) => x.t.slug), ...INSIGHTS.map((s) => s.id), ...modules.map((m) => m.key)],
    [modules, star, tools]
  );

  // The open section lives in the address (?view=seo), so Back, refresh and shared links all land on it.
  // Older links opened a tool with ?view=tools&tool=<slug>.
  const legacyTool = params.get("view") === "tools" ? params.get("tool") : null;
  const asked = legacyTool && isTool(legacyTool) ? legacyTool : (params.get("view") ?? "overview");
  const view: View = order.includes(asked as View) ? (asked as View) : "overview";
  const setView = useCallback((v: View) => {
    const q = new URLSearchParams(window.location.search);
    q.delete("tool");
    if (v === "overview") q.delete("view");
    else q.set("view", v);
    const s = q.toString();
    window.history.pushState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
    window.scrollTo({ top: 0 });
  }, []);
  const at = order.indexOf(view);
  const groupOf = (v: View) =>
    v === "overview" ? "Start" : v === "all" ? "Findings" : v in MODULE_NAMES ? "Areas" : INSIGHTS.some((s) => s.id === v) ? "From this scan" : STAR.some((s) => s.id === v) ? "Star features" : "Tools";

  const onToggle = (key: string) => {
    if (!canEdit) return; // viewers cannot change a report
    const f = scan.findings.find((x) => findingKey(x) === key);
    if (f?.severity === "high" && !fixed.has(key) && high === 1) {
      setParty(true);
      window.setTimeout(() => setParty(false), 3600);
    }
    toggle(key);
  };

  useShortcuts({ openPalette: () => setPalette(true), openHelp: () => setHelp(true), views: order, setView: (v) => setView(v as View), toggleKey: onToggle, step: (d) => { const v = order[at + d]; if (v) setView(v); } });

  const cmds: Cmd[] = [
    { id: "v-overview", label: "Overview", group: "Go to", icon: "health", run: () => setView("overview") },
    { id: "v-all", label: "All findings", group: "Go to", icon: "seo", run: () => setView("all") },
    ...modules.map((m): Cmd => ({ id: "v-" + m.key, label: m.name, hint: String(m.score), group: "Go to", icon: m.key, run: () => setView(m.key) })),
    ...[...star, ...INSIGHTS].map((s): Cmd => ({ id: "v-" + s.id, label: s.label, group: "Go to", run: () => setView(s.id) })),
    ...tools.map(({ t, n }): Cmd => ({ id: "v-" + t.slug, label: t.name, hint: n ? `${n} missing` : undefined, group: "Tools", run: () => setView(t.slug) })),
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
  const tool = isTool(view) ? TOOLS_BY_SLUG.get(view)! : null;
  const toolCtx = tool ? toolContext(scan.id, scan) : null;
  const needsPlan = (id: Extra) => PAID_ONLY.has(id) && access === "owner" && !!acct && !acct.paid;
  // The star features with a reason from this report each, in their fixed sidebar order.
  const pitches = star.map((g) => ({ g, p: pitchFor(g.id, { open: remaining, high, overall: potential, modules, saved: !!siteId, prev: !!prev, gscClicks: gsc ? gsc.totals.clicks : null }) }));
  const toolMissing = fixableCount(remaining);
  const topTool = tools[0]?.n ? tools[0].t : null;

  const [pdfBusy, setPdfBusy] = useState(false);
  // Paid owners get the server-rendered branded PDF; everyone else (and any failure) uses print-to-PDF.
  // Both include every issue: the print fallback opens the full report layout, not the section on screen.
  const pdf = async () => {
    if (access !== "owner" || !acct?.paid) {
      // The owner's own print can carry their Analytics section (a short-lived pass from the server).
      const url = fullReportPrintUrl(scan.id, access === "owner" ? await google.printPass(scan.id) : undefined);
      if (!window.open(url, "_blank")) window.location.assign(url);
      return;
    }
    setPdfBusy(true);
    const t = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
    await downloadPdf({ scanId: scan.id }, t, fullReportPrintUrl(scan.id));
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
  const go = (v: View) => () => {
    setModal(null);
    setView(v);
  };
  const nativeShare = () => void navigator.share?.({ title: `Website report for ${scan.host}`, text: `${scan.host} scores ${scan.overall}/100`, url: reportUrl }).catch(() => {});

  const navBtn = (v: View, icon: IconKey | React.ReactNode, label: string, badge?: React.ReactNode, cls?: string) => (
    <button key={v} type="button" className={cls} aria-current={view === v} onClick={() => setView(v)}>
      <span className="nv">{typeof icon === "string" ? <AreaIcon k={icon as IconKey} /> : icon}{label}</span>
      {badge}
    </button>
  );

  const statsOf = (id: Extra) => sectionStats(id, scan, prev, points.length);
  const hero = (s: Section, extra?: React.ReactNode) => (
    <section className="dash-hero sec-hero" aria-label={s.label}>
      <span className="sec-ico"><AreaIcon k={s.icon} size={28} /></span>
      <div className="dash-hero-txt">
        <p className="dash-eyebrow">{groupOf(s.id)}{needsPlan(s.id) && <span className="plan-badge">Paid plans</span>}</p>
        <h1>{s.label}</h1>
        <p>{s.text}</p>
        {statsOf(s.id).length > 0 && (
          <ul className="sec-stats" aria-label="Key numbers">
            {statsOf(s.id).map((st, i) => (
              <li key={st.label} className={st.tone ? `st-${st.tone}` : undefined} style={{ ["--i" as string]: i }}>
                <b>{st.value}</b>
                <span>{st.label}</span>
              </li>
            ))}
          </ul>
        )}
        <WhyItMatters text={WHY[s.id]} />
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
        <FindingsExplorer findings={scan.findings} fixed={fixed} onToggleFixed={canEdit ? onToggle : undefined} gains={gains} traffic={traffic} visits={visits} />
      </>
    );
  } else if (view === "overview") {
    body = (
      <>
        <section className="dash-hero bn bn-score" aria-label="Overall score" ref={watchHero}>
          <BannerFx />
          <div className="bn-ring">
            <CountRing score={potential} size={132} stroke={13} enabled={intro} />
          </div>
          <div className="dash-hero-txt">
            <p className="dash-eyebrow"><span className="bn-spark" aria-hidden="true">✦</span>Website Intelligence Score</p>
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
            <ul className="bn-chips" aria-label="This scan">
              <li><b>{modules.length}</b> areas scored</li>
              <li><b>{scan.crawl?.pages ?? 1}</b> {(scan.crawl?.pages ?? 1) === 1 ? "page" : "pages"} crawled</li>
              <li><b>{TOOL_LIST.length}</b> tools ready</li>
            </ul>
          </div>
        </section>

        <ul className="dash-cards dash-cards-13" aria-label="Scores by area and details from this scan">
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
          {INSIGHTS.map((s, i) => {
            const [main, sub] = statsOf(s.id);
            const t = main?.tone === "good" ? "good" : main?.tone === "ok" ? "warn" : main?.tone === "bad" ? "bad" : "none";
            return (
              <li key={s.id} className="dc-ins-li" style={{ ["--i" as string]: modules.length + i }}>
                <button type="button" className={`dc-ins dc-${t}`} onClick={() => setView(s.id)}>
                  <span className={`dc-stat${main && main.value.length > 4 ? " long" : ""}`} aria-hidden={main ? undefined : true}>
                    {main ? <b>{main.value}</b> : <AreaIcon k={s.icon} size={22} />}
                  </span>
                  <span className="dc-name"><AreaIcon k={s.icon} size={16} />{s.label}</span>
                  <span className="dc-n">{main ? main.label : "Not measured in this scan"}</span>
                  {sub && <span className={`dc-sub${sub.tone ? ` st-${sub.tone}` : ""}`}>{sub.value} {sub.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        {remaining.length > 0 && (
          <Findings findings={topFixes} title={traffic ? "Top fixes · by Google traffic" : "Top fixes"} fixed={fixed} onToggleFixed={canEdit ? onToggle : undefined} gains={gains} traffic={traffic} visits={visits} />
        )}
        {google.ai?.insights.length ? <AiOverviewCard ai={google.ai} onOpen={() => { setGTab("ga4"); setView("google"); }} /> : null}
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

        {pitches.length > 0 && (
          <section className="star-strip" aria-labelledby="star-h">
            <div className="bn bn-more">
              <BannerFx />
              <div className="bn-more-txt">
                <p className="bn-kicker"><span aria-hidden="true">★</span> Star features</p>
                <h2 id="star-h">Do more with this report</h2>
                <p>Keep watch over {scan.host}, see what ChatGPT says about it, line it up against rivals and send it to clients.</p>
              </div>
              <span className="bn-orbit" aria-hidden="true">
                <span className="bn-orbit-core">★</span>
                {pitches.map(({ g }, i) => (
                  <span key={g.id} className="bn-orbit-dot" style={{ ["--k" as string]: i, ["--n" as string]: pitches.length }}>
                    <span><AreaIcon k={g.icon} size={16} /></span>
                  </span>
                ))}
              </span>
            </div>
            <ul>
              {pitches.map(({ g, p }, i) => (
                <li key={g.id} style={{ ["--i" as string]: i }}>
                  <button type="button" onClick={() => setView(g.id)}>
                    <span className="ss-top">
                      <span className="ss-ico"><AreaIcon k={g.icon} size={20} /></span>
                      <span className="ss-name">{g.label}</span>
                      {needsPlan(g.id) && <span className="plan-badge">Paid plans</span>}
                    </span>
                    <b className="ss-hook">{p.hook}</b>
                    <span className="ss-text">{p.text}</span>
                    <span className="ss-cta">{p.cta} <span aria-hidden="true">→</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ToolsBanner host={scan.host} missing={toolMissing} top={topTool} onOpen={setView} />
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
            <WhyItMatters text={WHY[area]} />
            <p className="dash-sub">
              {inModule.length === 0
                ? "No issues found in this area."
                : countOf(area) === 0
                  ? "Everything here is marked as fixed."
                  : `${countOf(area)} of ${inModule.length} issue${inModule.length === 1 ? "" : "s"} still to look at.`}
            </p>
          </div>
        </section>
        {inModule.length > 0 && <Findings findings={inModule} fixed={fixed} onToggleFixed={canEdit ? onToggle : undefined} gains={gains} traffic={traffic} visits={visits} grouped />}
      </>
    );
  } else if (tool && toolCtx) {
    body = (
      <>
        <section className={`dash-hero sec-hero bn bn-tool ${TONE[tool.category]}`} aria-label={tool.name}>
          <BannerFx />
          <span className="sec-ico bn-tool-ic"><ToolIcon slug={tool.slug} size={30} /></span>
          <div className="dash-hero-txt">
            <p className="dash-eyebrow">Tools · {tool.category}{tool.paid && <span className="plan-badge">Paid plans</span>}</p>
            <h1>{tool.name}</h1>
            <p>{tool.lead}</p>
            <ul className="bn-chips" aria-label="About this tool">
              {(() => {
                const n = tools.find((x) => x.t.slug === tool.slug)?.n ?? 0;
                return <li className={n ? "bn-chip-hot" : "bn-chip-ok"}><b>{n || "✓"}</b> {n ? `missing item${n === 1 ? "" : "s"} to fix` : "nothing missing"}</li>;
              })()}
              <li>{tool.kind === "checker" ? "Checks the live site" : "Runs in your browser"}</li>
              <li>Pre-filled for {scan.host}</li>
            </ul>
          </div>
        </section>
        <DashTool slug={tool.slug} ctx={toolCtx} findings={remaining} />
      </>
    );
  } else if (section) {
    const s = section;
    let content: React.ReactNode = null;
    if (s.id === "speed") content = scan.vitals ? <VitalsPanel vitals={scan.vitals} /> : empty("Speed wasn't measured in this scan. Rescan to try again.");
    else if (s.id === "pages")
      // The crawl table needs at least two pages; a one-page crawl found no other pages to visit.
      content = (
        <>
          <CrawlWhyPanel crawl={scan.crawl} noSitemap={scan.findings.some((f) => f.id === "no-sitemap")} onTool={setView} />
          {(scan.crawl?.list.length ?? 0) >= 2 && <CrawlPanel crawl={scan.crawl} />}
        </>
      );
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
    else if (s.id === "tools") content = <DashToolGrid findings={remaining} onOpen={setView} />;
    else if (!owner) content = signInNote;
    else if (s.id === "assistant") content = access === "owner" ? <Assistant key={scan.id} scan={scan} paid={!!acct?.paid} /> : empty("The assistant needs accounts, which aren't switched on here.");
    else if (s.id === "google")
      content = access === "owner" ? (
        <GoogleData g={google} scan={scan} siteId={siteId} findings={remaining} onSave={() => setView("monitor")} onOpenArea={setView} tab={gTab} onTab={setGTab} />
      ) : empty("Google data needs accounts, which aren't switched on here.");
    else if (s.id === "monitor") content = access === "local" ? empty("Saving sites needs accounts, which aren't switched on here.") : <SaveSite scanId={scan.id} host={scan.host} />;
    else if (s.id === "ai")
      // The whole AI visibility tool, right here (the same tool as /account/visibility/<site>).
      content = siteId ? (
        <>
          {needsPlan("ai") && <p className="panel-note">AI visibility checks come with the Professional and Business plans. <Link className="fnd-link" href={AGENCY_UPSELL}>Talk to us about a plan</Link></p>}
          <Visibility siteId={siteId} embedded />
        </>
      ) : (
        <div className="panel sec-cta">
          <p>AI visibility runs on saved sites. Save {scan.host} first, then come back here.</p>
          <button type="button" className="dash-btn primary" onClick={() => setView("monitor")}>Save this site</button>
          {needsPlan("ai") && <p className="panel-note">AI visibility checks come with the Professional and Business plans. <Link className="fnd-link" href={AGENCY_UPSELL}>Talk to us about a plan</Link></p>}
        </div>
      );
    else if (s.id === "compare")
      content = (
        access === "owner" ? <CompareButton scanId={scan.id} host={scan.host} paid={!!acct?.paid} overall={scan.overall} modules={modules} /> : empty("Comparisons need accounts, which aren't switched on here.")
      );
    else if (s.id === "share") content = <BrandShare scanId={scan.id} host={scan.host} score={scan.overall} canEmail={!!canEmail} owner={access === "owner"} />;
    body = (
      <>
        {s.id === "tools" ? <ToolsBanner host={scan.host} missing={toolMissing} top={topTool} onOpen={setView} heading="h1" /> : hero(s)}
        {content}
      </>
    );
  }

  return (
    <div className={`dash${intro ? " intro" : ""}`}>
      <CommandPalette open={palette} onClose={() => setPalette(false)} cmds={cmds} />
      <ShortcutHelp open={help} onClose={() => setHelp(false)} />
      <ActionModal
        open={modal === "share"}
        onClose={() => setModal(null)}
        icon="share"
        title="Share this report"
        sub={`Anyone with the link sees the ${scan.host} report${canEdit ? " (view only: they can't tick findings or rescan)" : ""}.`}
        top={
          <div className="am-link">
            <input readOnly value={reportUrl} aria-label="Report link" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className={`dash-btn primary${copied ? " ok" : ""}`} onClick={() => void copy()}>{copied ? "Copied ✓" : "Copy link"}</button>
          </div>
        }
      >
        {canShare && <Tile icon="device" title="Share from this device" text="Messages, Slack, AirDrop or any app on your phone or computer." onClick={nativeShare} />}
        <Tile icon="mail" title="Email" text="Opens your email app with the link and score filled in." onClick={() => shareOut("mail")} />
        <Tile icon="chat" title="WhatsApp" text="Send the link and score in a WhatsApp chat." onClick={() => shareOut("wa")} />
        {owner && <Tile icon="share" title="Branded report for a client" text="Your logo and colours, by link or straight to their inbox." onClick={go("share")} badge={needsPlan("share") ? "Paid plans" : undefined} tone="accent" />}
      </ActionModal>
      <ActionModal open={modal === "export"} onClose={() => setModal(null)} icon="download" title="Export this report" sub="Take the findings with you, or hand them to whoever does the fixing.">
        <ExportTiles
          scan={scan}
          findings={scan.findings}
          fixed={fixed}
          pdfBusy={pdfBusy}
          pdfLabel={pdfBusy ? "Preparing PDF…" : access === "owner" && acct?.paid ? "Download PDF" : "Save as PDF"}
          pdfText={access === "owner" && acct?.paid ? "A branded PDF of the whole report, made on our servers." : "The full report with every issue. Your browser's print window opens; choose Save as PDF."}
          onPdf={() => {
            setModal(null);
            void pdf();
          }}
        />
      </ActionModal>
      <ActionModal open={modal === "more"} onClose={() => setModal(null)} icon="dots" title="More you can do" sub="Tools that build on this report, and shortcuts for moving around it.">
        {pitches.map(({ g, p }) => (
          <Tile key={g.id} icon={g.icon} title={g.label} text={p.hook} onClick={go(g.id)} badge={needsPlan(g.id) ? "Paid plans" : undefined} />
        ))}
        <Tile icon="search" title="Search the report" text="Jump to any area, finding or action (Ctrl K)." onClick={() => { setModal(null); setPalette(true); }} />
        <Tile icon="keyboard" title="Keyboard shortcuts" text="Move through findings and tick them off without the mouse." onClick={() => { setModal(null); setHelp(true); }} />
      </ActionModal>
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
          {access === "owner" && <RescanButton url={scan.url} id={scan.id} running={params.get("scan")} />}
          <button type="button" className="dash-btn ico-btn" onClick={openShare}><AreaIcon k="share" size={16} />Share</button>
          <button type="button" className="dash-btn ico-btn" onClick={() => setModal("export")}><AreaIcon k="download" size={16} />{pdfBusy ? "Preparing PDF…" : "Export"}</button>
          <button type="button" className="dash-btn ico-btn" onClick={() => setModal("more")}><AreaIcon k="dots" size={16} />More</button>
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
          {navBtn("all", "list", "All findings", <b>{scan.findings.length}</b>)}
          {star.length > 0 && (
            <div className="nav-star">
              <p className="nav-h"><span aria-hidden="true">★</span> Star features</p>
              {star.map((s) => navBtn(s.id, s.icon, s.label, needsPlan(s.id) ? <span className="plan-dot" title="Paid plans">Paid</span> : undefined))}
            </div>
          )}
          <p className="nav-h">Tools</p>
          {mainTools.map(({ t, n }) => navBtn(t.slug, <ToolIcon slug={t.slug} size={16} />, t.name, n ? <b className="nav-miss" title={`${n} missing`}>{n}</b> : undefined, "nav-tool"))}
          {/* The tool on screen stays visible in the sidebar even when it isn't one of the main five. */}
          {tool && !mainTools.some((x) => x.t.slug === tool.slug) && navBtn(tool.slug, <ToolIcon slug={tool.slug} size={16} />, tool.name, undefined, "nav-tool")}
          {navBtn("tools", "tools", "More tools", <b>{TOOL_LIST.length}</b>, "nav-more")}
        </nav>

        <main className="dash-main">
          {body}
        </main>
      </div>
      {/* The small chat widget: the report stays visible and scrollable behind it on wide screens; on phones it
          opens as a sheet. It shares its conversation with the full Ask Pagelyt view (Expand opens that view). */}
      {access === "owner" && view !== "assistant" && chat && (
        <div
          className="asst-pop"
          role="dialog"
          aria-label="Ask Pagelyt"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setChat(false);
              document.querySelector<HTMLButtonElement>(".asst-fab")?.focus();
            }
          }}
        >
          <Assistant
            key={scan.id}
            scan={scan}
            paid={!!acct?.paid}
            mini
            onClose={() => setChat(false)}
            onExpand={() => {
              setChat(false);
              setView("assistant");
            }}
          />
        </div>
      )}
      {access === "owner" && view !== "assistant" && (
        <button type="button" className={`asst-fab${chat ? " open" : ""}`} onClick={() => setChat((c) => !c)} aria-expanded={chat} aria-label={chat ? "Close the chat" : "Ask Pagelyt about this report"}>
          {chat ? <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg> : <AreaIcon k="chat" size={20} />}
          <span>{chat ? "Close" : "Ask"}</span>
        </button>
      )}
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

/* "Why it matters", folded to one line until opened. */
function WhyItMatters({ text }: { text: string }) {
  return (
    <details className="sec-why">
      <summary>Why it matters</summary>
      <p>{text}</p>
    </details>
  );
}

/* Decoration behind every animated banner: drifting light, a faint grid and twinkling sparks. */
const SPARKS = [[8, 22], [18, 78], [34, 12], [52, 70], [66, 18], [78, 84], [90, 30], [96, 66]];
function BannerFx() {
  return (
    <span className="bn-fx" aria-hidden="true">
      <i className="bn-orb o1" />
      <i className="bn-orb o2" />
      <i className="bn-orb o3" />
      <i className="bn-grid" />
      <i className="bn-sweep" />
      {SPARKS.map(([x, y], k) => <i key={k} className="bn-sp" style={{ left: `${x}%`, top: `${y}%`, ["--k" as string]: k }} />)}
    </span>
  );
}

/* The free tools, as a banner: on the Overview and as the heading of the All tools page. Tool icons circle the
   count of missing items they can fix; the button opens the tool with the most to fix. */
function ToolsBanner({ host, missing, top, onOpen, heading = "h2" }: { host: string; missing: number; top: ToolInfo | null; onOpen: (v: ToolSlug | "tools") => void; heading?: "h1" | "h2" }) {
  const H = heading;
  const ring = TOOL_LIST.slice(0, 8);
  return (
    <section className="bn bn-tools" aria-labelledby="bn-tools-h">
      <BannerFx />
      <span className="bn-tools-art" aria-hidden="true">
        <span className="bn-tools-core"><b>{missing || TOOL_LIST.length}</b><small>{missing ? "to fix" : "tools"}</small></span>
        {ring.map((t, i) => (
          <span key={t.slug} className="bn-orbit-dot" style={{ ["--k" as string]: i, ["--n" as string]: ring.length }}>
            <span><ToolIcon slug={t.slug} size={15} /></span>
          </span>
        ))}
      </span>
      <div className="bn-tools-txt">
        <p className="bn-kicker">{TOOL_LIST.length} free tools · pre-filled for {host}</p>
        <H id="bn-tools-h">{missing ? `${missing} missing item${missing === 1 ? " has" : "s have"} a free fix` : "Checkers and generators, ready to use"}</H>
        <p>{top ? `Start with the ${top.name}: it fixes the most from this scan.` : "Make llms.txt, robots.txt, schema, security headers and sitemaps without starting from a blank page."}</p>
      </div>
      <span className="bn-ctas">
        {top && (
          <button type="button" className="bn-cta" onClick={() => onOpen(top.slug)}>
            Open {top.name} <span aria-hidden="true">→</span>
          </button>
        )}
        {heading === "h2" && (
          <button type="button" className="bn-cta ghost" onClick={() => onOpen("tools")}>
            See all {TOOL_LIST.length} tools
          </button>
        )}
      </span>
    </section>
  );
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
