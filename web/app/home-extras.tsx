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
          <p className="lead">Checkers, generators and guides for the issues scans find most often. Free with a Pagelyt account.</p>
        </div>
        <div className="tg-cards">
          <Link href="/tools" className="tg-card">
            <h3>Free tools</h3>
            <p>Check which AI bots can reach you, test <code>robots.txt</code> and hreflang, and generate <code>llms.txt</code>, schema markup and security headers.</p>
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
    ["Free tools, no install", "Checkers and generators for the most common fixes, free with an account."],
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
