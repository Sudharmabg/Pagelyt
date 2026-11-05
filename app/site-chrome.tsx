import Link from "next/link";
import { BowlArcs } from "./art";
import { FEATURES } from "./features-data";
import { CONTACT_EMAIL } from "./site-config";

const MENU: [string, string][] = [
  ["Features", "/features"],
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["Use cases", "/use-cases"],
  ["Consultation", "/consultation"],
];

export function SiteNav() {
  return (
    <header className="nav">
      <div className="container nav-in">
        <Link className="logo logo-img" href="/" aria-label="Pagelyt home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Pagelyt" width={163} height={35} />
        </Link>
        <nav className="menu" aria-label="Main">
          {MENU.map(([n, h]) => (
            <Link key={n} href={h}>
              {n}
            </Link>
          ))}
        </nav>
        <div className="nav-act">
          <Link className="plain" href="/faq">
            FAQ
          </Link>
          <Link className="btn sm" href="/">
            Analyse a website
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const fills = ["var(--i500)", "var(--i300)", "var(--lime)", "var(--i400)", "var(--i200)", "var(--i500)", "var(--lime)"];
  const heights = [78, 100, 66, 90, 72, 100, 84];
  return (
    <footer className="foot">
      <BowlArcs />
      <div className="container">
        <div className="blocks" role="img" aria-label="pagelyt">
          {"pagelyt".split("").map((l, i) => (
            <span key={i} className="blk" aria-hidden="true" style={{ background: fills[i], height: `${heights[i]}%` }}>
              {l}
            </span>
          ))}
        </div>
        <div className="foot-top foot3">
          <div className="foot-brand">
            <p className="tag">Illuminate Your Website.</p>
            <p>Website analysis and monitoring for speed, SEO, AI search readiness, security and accessibility.</p>
          </div>
          <nav aria-label="Features">
            <h4>Features</h4>
            {FEATURES.map((f) => (
              <Link key={f.slug} href={`/features/${f.slug}`}>
                {f.name}
              </Link>
            ))}
          </nav>
          <nav aria-label="Learn">
            <h4>Learn</h4>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/use-cases">Use cases</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/faq">FAQ</Link>
          </nav>
          <nav aria-label="Company">
            <h4>Company</h4>
            <Link href="/about">About Pagelyt</Link>
            <Link href="/consultation">Book a consultation</Link>
            <Link href="/contact">Contact us</Link>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </nav>
        </div>
        <div className="foot-last">
          <span>Copyright &copy; 2026 Pagelyt. All rights reserved.</span>
          <span className="foot-legal">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
