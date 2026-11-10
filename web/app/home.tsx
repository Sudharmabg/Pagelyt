"use client";

import { Arrow } from "./arrow";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Arcs, Funnel } from "./art";
import { PLANS } from "./content";
import { Glance, NumberedRows, RibbonFrame } from "./home-parts";
import { AreaStrip, ToolsAndGuides, TrustRow } from "./home-extras";
import { SiteFooter, SiteNav } from "./site-chrome";
import { Sources } from "./sources";
import { WelcomeBack } from "./welcome-back";
import { ScanPreview, type ModScore } from "./ui";
import { LeadModal, type ScanProblem, type ScanStart } from "./lead-modal";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { sessionFresh } from "@/lib/session-age";

const BASE: ModScore[] = [
  { name: "Website health", score: 92 },
  { name: "Performance", score: 74 },
  { name: "SEO", score: 82 },
  { name: "GEO readiness", score: 68 },
  { name: "Security", score: 61 },
  { name: "Accessibility", score: 87 },
];


const AUDIENCE = {
  biz: {
    sub: "A free AI-powered website audit for SEO, page speed, security, accessibility and GEO (AI search). One clear score, with fixes ranked by impact.",
    cta: "Analyse My Website",
    adv: [
      "Free to start, nothing to install",
      "8 areas, 1 clear score",
      "Fixes ranked by impact",
      "Plain English, no jargon",
      "Rescan to track progress",
    ],
  },
  agency: {
    sub: "Audit client websites in minutes, then monitor every site you manage.",
    cta: "Analyse a Client Site",
    adv: [
      "Audit any client site from a URL",
      "White-label PDF reports on Business",
      "Monitor every site you manage",
      "Fixes ranked by impact",
      "Competitor benchmarks from Professional",
    ],
  },
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [host, setHost] = useState("");
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [claimDomain, setClaimDomain] = useState(""); // set when a signed-in visitor's site belongs to another account

  const overall = Math.round(BASE.reduce((a, m) => a + m.score, 0) / BASE.length);

  useEffect(() => {
    document.documentElement.classList.add("js");
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    document.querySelectorAll("[data-r]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const openModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim().includes(".")) {
      setError("Enter a full address such as https://example.com");
      return;
    }
    setError("");
    setClaimDomain("");
    setHost(url.trim().replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0]);
    // Signed-in visitors are already known to us: skip the form and scan straight away.
    const session = (await supabaseBrowser()?.auth.getSession())?.data.session;
    const token = session && sessionFresh(session.access_token) ? session.access_token : undefined; // older than 7 days: log in again
    if (token) {
      setRunning(true);
      setModal(true);
      const problem = await startScan({ lead: null, token, after: "dashboard" });
      if (problem?.code === "signed_out") {
        // The saved session is no longer valid: drop it and show the login / sign-up form instead.
        await supabaseBrowser()?.auth.signOut({ scope: "local" });
        setRunning(false);
        return;
      }
      if (problem) {
        setRunning(false);
        setModal(false);
        setError(problem.error);
        if (problem.code === "not_owner") setClaimDomain(problem.domain ?? "");
      }
      return;
    }
    setModal(true);
  };

  /* Runs the scan with the visitor's details, then opens their dashboard. A brand-new account that still has to
     enter its email code goes to its (locked) dashboard at once, and the scan carries on from there. */
  const startScan = async ({ lead, turnstile, ticket, token }: ScanStart): Promise<ScanProblem | null> => {
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: url.trim(), ...(lead ? { lead } : {}), turnstile, ticket }),
      });
      const start = await res.json();
      if (!res.ok) return { error: start.error || "Scan failed.", code: start.code, domain: start.domain };
      // The dashboard runs the scan and shows each area as it finishes. A signed-in visitor's scan is theirs:
      // the dashboard saves it to their account when it's done (?new=1); a cached, finished scan is saved here.
      if (token && start.done) await fetch("/api/account/claim", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ scanId: start.id }) }).catch(() => {});
      router.push(`/dashboard/${start.id}${token && !start.done ? "?new=1" : ""}`);
      return null;
    } catch {
      return { error: "Could not reach the server. Please try again." };
    }
  };

  const note = error || "Free to start. No complicated setup. No technical expertise required.";

  const renderForm = (id: string, cls = "url-form") => (
    <form className={cls} onSubmit={openModal} noValidate>
      <label className="sr-only" htmlFor={id}>
        Website URL
      </label>
      <input
        id={id}
        type="text"
        inputMode="url"
        placeholder="https://yourwebsite.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button className="btn" type="submit">
        Analyse Website <Arrow />
      </button>
    </form>
  );

  const goAnalyse = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => document.getElementById("hero-url")?.focus(), 450);
  };

  const copy = AUDIENCE.biz;

  return (
    <main id="top">
      <SiteNav />

      {/* 1. HERO: ribbons behind, headline in front, big URL box, then the advantages */}
      <section className="hero hero-c" aria-labelledby="h1">
        <Arcs />
        <div className="container hero-stack">
          <WelcomeBack />
          <h1 id="h1" data-r>
            Audit your website. Fix what holds it back.
          </h1>
          <p className="sub" data-r style={{ ["--d" as string]: 1 }}>
            {copy.sub}
          </p>

          <div data-r style={{ ["--d" as string]: 2 }}>
            {renderForm("hero-url", "url-form mega")}
            <p className={`note${error ? " err" : ""}`} role="status">
              {note}
              {claimDomain && (
                <>
                  {" "}
                  <Link href={`/claim?domain=${encodeURIComponent(claimDomain)}`}>Prove you own it</Link>
                </>
              )}
            </p>
          </div>

          <ul className="adv" aria-label="Why use Pagelyt" data-r style={{ ["--d" as string]: 3 }}>
            {copy.adv.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>


          <div className="hero-prev2" data-r style={{ ["--d" as string]: 4 }}>
            <ScanPreview mods={BASE} overall={overall} phase="sample" host="" progress={0} stepText="" />
          </div>
        </div>
      </section>

      <LeadModal
        open={modal}
        url={url.trim()}
        host={host}
        running={running}
        onClose={() => setModal(false)}
        onSubmit={startScan}
      />

      {/* 2. THREE NUMBERED STEPS */}
      <section className="sec" id="product" aria-labelledby="num-h">
        <div className="container">
          <div className="head-center" data-r>
            <h2 className="title" id="num-h">
              One URL becomes a clear plan.
            </h2>
            <p className="lead">
              Pagelyt is a website analysis and monitoring platform: scores for health, speed, SEO, AI search
              readiness, security and accessibility, with fixes ranked by impact.
            </p>
          </div>
          <NumberedRows />
        </div>
      </section>

      {/* 3. THE BOTTLE PANEL */}
      <section className="sec tight" aria-label="From numbers to answers">
        <div className="container" data-r>
          <Funnel />
        </div>
      </section>

      {/* 4. SKY SECTION: how it analyses, try it now, at a glance */}
      <section className="sec ice sky-sec" id="how" aria-labelledby="src-h">
        <Sources />

        <div className="container try" id="try">
          <RibbonFrame>
            <h2 className="title" id="try-h">
              Analyse your website now.
            </h2>
            <p className="lead">Paste a URL and see your report. Free to start, nothing to install.</p>
            {renderForm("final-url")}
            <p className="note">Prefer to talk it through? </p>
            <div className="btn-row" style={{ justifyContent: "center", marginTop: 6 }}>
              <Link className="btn ghost" href="/consultation">
                Book a consultation
              </Link>
              <Link className="btn ghost" href="/how-it-works">
                See how it works
              </Link>
            </div>
          </RibbonFrame>
        </div>

        <div className="container" style={{ marginTop: "clamp(72px, 8vw, 120px)" }}>
          <div className="head-center" data-r>
            <h2 className="title" id="glance-h">
              Pagelyt at a glance.
            </h2>
          </div>
          <Glance />
        </div>
      </section>

      <AreaStrip />
      <ToolsAndGuides />

      {/* 5. PRICING */}
      <section className="sec" id="pricing" aria-labelledby="price-h">
        <div className="container">
          <h2 className="title" id="price-h" data-r>
            Simple, transparent pricing.
          </h2>
          <div className="plans" data-r>
            {PLANS.map((p) => (
              <div className={`plan${p.badge ? " pop" : ""}`} key={p.name}>
                {p.badge && <span className="badge">Most popular</span>}
                <p className="nm">{p.name[0] + p.name.slice(1).toLowerCase()}</p>
                <p className="pc">
                  {p.price}
                  <small>{p.per}</small>
                </p>
                <p className="for">{p.for}</p>
                <p className="hd">{p.head}</p>
                <ul>
                  {p.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
                <button className={`btn${p.badge ? "" : " ghost"}`} onClick={goAnalyse}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
          <div className="price-cta">
            <p>Free website analysis included. Paid plans are billed annually per website.</p>
            <Link className="btn ghost" href="/pricing">
              Compare all plans <Arrow />
            </Link>
          </div>
        </div>
      </section>

      <TrustRow />
      <SiteFooter />
    </main>
  );
}
