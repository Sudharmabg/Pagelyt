import Link from "next/link";
import { Arrow } from "./arrow";
import { AreaIcon } from "./dashboard/icons";
import { MODULE_NAMES, type ModuleKey } from "@/lib/scan/types";

const AREAS = Object.keys(MODULE_NAMES) as ModuleKey[];

/* Eight areas light up in sequence, then hold. Pure CSS; static for reduced motion. */
export function AreaStrip() {
  return (
    <section className="sec tight areas-sec" aria-labelledby="areas-h">
      <div className="container head-center">
        <h2 className="title" id="areas-h">Eight areas. One scan.</h2>
        <p className="lead">Every scan checks all of these, then ranks what to fix by impact.</p>
        <ul className="area-strip" aria-label="Areas checked">
          {AREAS.map((k, i) => (
            <li key={k} style={{ ["--i" as string]: i }}>
              <AreaIcon k={k} size={22} />
              <span>{MODULE_NAMES[k]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ToolsAndGuides() {
  return (
    <section className="sec" aria-labelledby="tools-h">
      <div className="container">
        <div className="head-center">
          <h2 className="title" id="tools-h">Fix things yourself, free.</h2>
          <p className="lead">Generators and guides for the issues scans find most often. Nothing you type leaves your browser.</p>
        </div>
        <div className="tg-cards">
          <Link href="/tools" className="tg-card">
            <h3>Free tools</h3>
            <p>Generate <code>llms.txt</code>, <code>robots.txt</code>, schema markup and security headers, and preview your search snippet.</p>
            <span>Open the tools <Arrow /></span>
          </Link>
          <Link href="/fix" className="tg-card">
            <h3>Fix guides</h3>
            <p>Step-by-step help for SEO, security, speed, accessibility, privacy and email problems, written for owners first.</p>
            <span>Browse the guides <Arrow /></span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function TrustRow() {
  const items = [
    ["Private by link", "Reports are only visible to people you share the link with, and are never indexed."],
    ["Evidence, not guesses", "Every finding shows what we saw and how to fix it."],
    ["Honest limits", "Automated checks aren’t a compliance certificate. We say what the scan can’t tell you."],
    ["Runs in your browser", "Free tools process your input locally. Nothing is uploaded."],
  ];
  return (
    <section className="sec tight trust-sec" aria-label="Why you can trust Pagelyt">
      <div className="container">
        <ul className="trust-row">
          {items.map(([h, p]) => (
            <li key={h}>
              <strong>{h}</strong>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
