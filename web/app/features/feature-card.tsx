import Link from "next/link";
import { Arrow } from "../arrow";
import { FEATURES, type Feature } from "../features-data";
import { RevealList } from "../reveal";
import { AiMock, AnalyticsMock, CompareMock, HealthMock, PerfMock, SecA11yMock, SeoGeoMock, TimelineMock } from "../ui";

/** The dashboard mock that illustrates each feature. */
export const MOCKS: Record<string, () => React.ReactElement> = {
  "website-health": HealthMock,
  performance: PerfMock,
  "seo-geo": SeoGeoMock,
  "security-accessibility": SecA11yMock,
  "competitor-intelligence": CompareMock,
  "ai-recommendations": AiMock,
  "monitoring-reports": TimelineMock,
  "analytics-integrations": AnalyticsMock,
};

/** Colour tone for a feature (purple, green, pink, amber), the same order the /features page uses. */
const tone = (slug: string) => `ft-${Math.max(0, FEATURES.findIndex((f) => f.slug === slug)) % 4}`;

/* decorative icons for the three gains: a spark, a target and a rising line */
const GAIN_ICONS = [
  <path key="spark" d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />,
  <g key="target"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></g>,
  <g key="trend"><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></g>,
];

/** "What you get": the feature's gains as numbered colour cards that rise in one after another. */
export function FeatureGains({ f }: { f: Feature }) {
  return (
    <RevealList className="fgain-list" label={`What you get from ${f.name}`}>
      {f.gains.map(([t, d], i) => (
        <li key={t} className={`fgain-card fg-${i % 3}`} style={{ ["--i" as string]: i }}>
          <span className="fg-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24">{GAIN_ICONS[i % 3]}</svg>
          </span>
          <span className="fg-tx">
            <b>{t}</b>
            <span>{d}</span>
          </span>
          <span className="fg-num" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
        </li>
      ))}
    </RevealList>
  );
}

/** One feature as a card with a small preview of its dashboard. Hover pans the preview to show more. */
export function FeatureCard({ f }: { f: Feature }) {
  const Mock = MOCKS[f.slug];
  return (
    <Link href={`/features/${f.slug}`} className={`fcard ${tone(f.slug)}`}>
      <span className="fcard-pv" aria-hidden="true">
        <span className="fcard-pv-in">{Mock && <Mock />}</span>
      </span>
      <span className="fcard-tx">
        <b>{f.name}</b>
        <span>{f.short}</span>
      </span>
      <span className="tf-go">
        Learn more <Arrow />
      </span>
    </Link>
  );
}

/** A wide banner linking to /features, listing every feature. The whole banner is the link. */
export function AllFeaturesBanner({ current }: { current?: string }) {
  return (
    <Link href="/features" className="tall-band fall-band">
      <span className="tall-copy">
        <b>{FEATURES.length} features. One free scan.</b>
        <span>Speed, SEO, AI search, security, accessibility and more, all from a single URL.</span>
      </span>
      <span className="tall-icons fall-pills" aria-hidden="true">
        {FEATURES.map((f, i) => (
          <span key={f.slug} className={`fall-pill ${tone(f.slug)}${f.slug === current ? " on" : ""}`} style={{ ["--i" as string]: i }}>
            {f.name}
          </span>
        ))}
      </span>
      <span className="btn tall-btn">
        See all features <Arrow />
      </span>
    </Link>
  );
}
