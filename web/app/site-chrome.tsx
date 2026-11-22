import Link from "next/link";
import { BowlArcs } from "./art";
import { AuthLink } from "./auth-link";
import { FEATURES } from "./features-data";
import { NavMobile } from "./nav-mobile";
import { FeaturesMenu, type MenuFeature } from "./features-menu";
import { FREE_TOOLS } from "./home-data";
import { MainCta } from "./main-cta";
import { CONTACT_EMAIL, PRICING_ON } from "./site-config";
import { SignInLink } from "@/app/sign-in-modal";
import { CookieSettingsLink } from "./cookie-consent";

const MENU: [string, string][] = [
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["Consultation", "/consultation"],
  ["Blog", "/blog"],
].filter(([, href]) => PRICING_ON || href !== "/pricing") as [string, string][];

// Features menu: every feature (Google data gets its own card on desktop), then the free tools.
const MENU_FEATURES: MenuFeature[] = FEATURES.map(({ slug, name, short, area, products }) => ({ slug, name, short, area, pills: products?.map((p) => p.name) }));
const GOOGLE = MENU_FEATURES.find((f) => f.slug === "google-integrations");

export function SiteNav() {
  return (
    <header className="nav">
      <div className="container nav-in">
        <Link className="logo logo-img" href="/" aria-label="Pagelyt home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Pagelyt" width={163} height={35} />
        </Link>
        <nav className="menu" aria-label="Main">
          <FeaturesMenu features={MENU_FEATURES.filter((f) => f !== GOOGLE)} google={GOOGLE} tools={FREE_TOOLS.length} />
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
          <AuthLink />
          <MainCta className="btn sm nav-cta" label="Analyse a website" signedLabel="Dashboard" signedClassName="is-dash" />
          <NavMobile
            features={MENU_FEATURES}
            tools={FREE_TOOLS.length}
            links={[...MENU.map(([name, href]) => ({ name, href })), { name: "FAQ", href: "/faq" }]}
          />
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
            <Link href="/tools">Free tools</Link>
            <Link href="/fix">Fix guides</Link>
            <Link href="/blog">Blog</Link>
            <SignInLink>Sign in</SignInLink>
            {PRICING_ON && <Link href="/pricing">Pricing</Link>}
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
            <CookieSettingsLink />
          </span>
        </div>
      </div>
    </footer>
  );
}
