"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Findings } from "../findings";
import { Ring, tone } from "../ui";
import { findingKey, overallScore, scoreModules } from "@/lib/scan/score";
import { MODULE_NAMES, type ModuleKey } from "@/lib/scan/types";
import { AreaIcon } from "./icons";
import { SaveSite } from "./save-site";
import { ShareReport } from "./share-report";
import { RescanButton } from "./rescan";
import { AgencyModal, useAccount } from "./agency-modal";
import { CompareButton } from "./compare-button";
import { downloadPdf } from "@/lib/download-pdf";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { CommandPalette, RadarPanel, ShortcutHelp, useShortcuts, type Cmd } from "./extras";
import { ComparePanel, DomainPanel, ExportMenu, FindingsExplorer, CrawlPanel, ChangePanel, HowScores, ImagesPanel, QuickWins, TechPanel, VitalsPanel, useHistory, type Snap } from "./panels";
import type { StoredScan } from "@/lib/scan/store";

type View = "overview" | "all" | ModuleKey;

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

export function Dashboard({ scan, history, savedFixed, shots }: { scan: StoredScan; history?: Snap[]; savedFixed?: string[] | null; shots?: { now: string | null; prev: string | null } }) {
  const [view, setView] = useState<View>("overview");
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
  const [pinned, setPinned] = useState(false);
  const [party, setParty] = useState(false);
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);

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

  const onToggle = (key: string) => {
    if (!canEdit) return; // viewers cannot change a report
    const f = scan.findings.find((x) => findingKey(x) === key);
    if (f?.severity === "high" && !fixed.has(key) && high === 1) {
      setParty(true);
      window.setTimeout(() => setParty(false), 3600);
    }
    toggle(key);
  };

  const viewIds = useMemo(() => ["overview", "all", ...modules.map((m) => m.key)], [modules]);
  useShortcuts({ openPalette: () => setPalette(true), openHelp: () => setHelp(true), views: viewIds, setView: (v) => setView(v as View), toggleKey: onToggle });

  const cmds: Cmd[] = [
    { id: "v-overview", label: "Overview", group: "Go to", icon: "health", run: () => setView("overview") },
    { id: "v-all", label: "All findings", group: "Go to", icon: "seo", run: () => setView("all") },
    ...modules.map((m): Cmd => ({ id: "v-" + m.key, label: m.name, hint: String(m.score), group: "Go to", icon: m.key, run: () => setView(m.key) })),
    { id: "a-print", label: "Print or save as PDF", group: "Actions", run: () => window.print() },
    { id: "a-help", label: "Keyboard shortcuts", group: "Actions", run: () => setHelp(true) },
    { id: "a-new", label: "Scan another site", group: "Actions", run: () => router.push("/") },
    ...remaining.slice(0, 40).map((f): Cmd => ({ id: "f-" + findingKey(f), label: f.title, hint: MODULE_NAMES[f.module], group: "Findings", icon: f.module, run: () => setView(f.module) })),
  ];
  const when = new Date(scan.scannedAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  const countOf = (k: ModuleKey) => remaining.filter((f) => f.module === k).length;
  const inModule = view === "overview" || view === "all" ? [] : scan.findings.filter((f) => f.module === view);
  const mod = view === "overview" || view === "all" ? null : modules.find((m) => m.key === view)!;

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
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the URL is still in the address bar */
    }
  };

  return (
    <div className={`dash${intro ? " intro" : ""}`}>
      <CommandPalette open={palette} onClose={() => setPalette(false)} cmds={cmds} />
      <ShortcutHelp open={help} onClose={() => setHelp(false)} />
      <PrintCover scan={scan} overall={potential} modules={modules} />
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
          <strong>{scan.host}</strong>
          <span>Scanned {when} UTC</span>
        </div>
        <div className="dash-act">
          <button type="button" className="dash-btn kbd-btn" onClick={() => setPalette(true)} aria-label="Search and jump (Ctrl K)">
            Search <kbd>Ctrl K</kbd>
          </button>
          {canEdit && <SaveSite scanId={scan.id} />}
          {canEdit && <ShareReport scanId={scan.id} />}
          {access === "owner" && <CompareButton scanId={scan.id} host={scan.host} paid={!!acct?.paid} />}
          {access === "owner" && <RescanButton url={scan.url} />}
          <ExportMenu scan={scan} findings={scan.findings} fixed={fixed} />
          <Link className="dash-btn" href={`/tools?scan=${scan.id}`}>Fix with free tools</Link>
          <button type="button" className="dash-btn" disabled={pdfBusy} onClick={pdf}>
            {pdfBusy ? "Preparing PDF…" : access === "owner" && acct?.paid ? "Download PDF" : "Print / PDF"}
          </button>
          <button type="button" className="dash-btn" onClick={copy}>
            {copied ? "Link copied" : "Copy link"}
          </button>
          <Link href="/" className="dash-btn primary">
            Scan another site
          </Link>
        </div>
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
          <button type="button" aria-current={view === "overview"} onClick={() => setView("overview")}>
            <span className="nv"><AreaIcon k="health" />Overview</span>
            <b>{remaining.length}</b>
          </button>
          <button type="button" aria-current={view === "all"} onClick={() => setView("all")}>
            <span className="nv"><AreaIcon k="seo" />All findings</span>
            <b>{scan.findings.length}</b>
          </button>
          <hr className="nav-sep" />
          {modules.map((m) => (
            <button key={m.key} type="button" aria-current={view === m.key} onClick={() => setView(m.key)}>
              <span className="nv"><AreaIcon k={m.key} />{m.name}</span>
              <b className={`t-${tone(m.score)}`}>{m.score}</b>
            </button>
          ))}
        </nav>

        <main className="dash-main">
          {view === "all" ? (
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
          ) : view === "overview" ? (
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
              <div className="panel-grid">
                <RadarPanel modules={modules} />
                <ComparePanel scan={scan} prev={prev} trend={trend} synced={synced} points={points} />
              </div>
              <ChangePanel scan={scan} shots={shots} />
              <VitalsPanel vitals={scan.vitals} />
              <ImagesPanel images={scan.images} weight={scan.vitals?.weight} />
              <div className="panel-grid">
                <DomainPanel domain={scan.domain} links={scan.links} at={scan.scannedAt} />
                <TechPanel tech={scan.tech} />
              </div>
              <CrawlPanel crawl={scan.crawl} />
              <HowScores />
            </>
          ) : (
            <>
              <section className="dash-hero" aria-label={`${mod!.name} score`}>
                <CountRing score={mod!.score} size={104} stroke={11} enabled={intro} />
                <div className="dash-hero-txt">
                  <p className="dash-eyebrow">{MODULE_NAMES[view]}</p>
                  <h1>{mod!.score >= 80 ? "Looking good" : mod!.score >= 50 ? "Needs work" : "Needs attention"}</h1>
                  <p>{BLURB[view]}</p>
                  <p className="dash-sub">
                    {inModule.length === 0
                      ? "No issues found in this area."
                      : countOf(view) === 0
                        ? "Everything here is marked as fixed."
                        : `${countOf(view)} of ${inModule.length} issue${inModule.length === 1 ? "" : "s"} still to look at.`}
                  </p>
                </div>
              </section>
              {inModule.length > 0 && (
                <Findings findings={inModule} fixed={fixed} onToggleFixed={canEdit ? onToggle : undefined} gains={gains} grouped />
              )}
            </>
          )}
        </main>
      </div>
    </div>
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
function PrintCover({ scan, overall, modules }: { scan: StoredScan; overall: number; modules: { key: string; name: string; score: number }[] }) {
  const when = new Date(scan.scannedAt).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" });
  return (
    <section className="print-cover" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={180} height={38} />
      <p className="pc-kicker">Website Intelligence Report</p>
      <h1>{scan.host}</h1>
      <p className="pc-date">Scanned {when}</p>
      <div className="pc-score"><b>{overall}</b><span>/ 100</span></div>
      <ul>
        {modules.map((m) => (
          <li key={m.key}><span>{m.name}</span><b>{m.score}</b></li>
        ))}
      </ul>
      <p className="pc-foot">{scan.findings.length} findings · Automated checks, not a compliance certificate · pagelyt.com</p>
    </section>
  );
}
