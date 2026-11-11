import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow } from "../../arrow";
import { AreaIcon } from "../../dashboard/icons";
import { JsonLd, crumbLd } from "../../json-ld";
import { CtaBand, PageHero } from "../../page-shell";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { SITE_URL } from "../../site-config";
import { GUIDES, GUIDE_ORDER } from "@/lib/scan/guides";
import { MODULE_NAMES } from "@/lib/scan/types";
import { CopyCode } from "../copy-code";

export const generateStaticParams = () => Object.keys(GUIDES).map((id) => ({ id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const g = GUIDES[id];
  if (!g) return {};
  return { title: `${g.title}: ${MODULE_NAMES[g.module]} fix guide`, description: g.summary, alternates: { canonical: `/fix/${id}` } };
}

export default async function FixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = GUIDES[id];
  if (!g) notFound();
  const area = MODULE_NAMES[g.module];
  const at = GUIDE_ORDER.indexOf(id);
  const prev = at > 0 ? GUIDE_ORDER[at - 1] : null;
  const next = at < GUIDE_ORDER.length - 1 ? GUIDE_ORDER[at + 1] : null;
  // same-area guides, minus the ones already offered as previous/next
  const related = GUIDE_ORDER.filter((x) => x !== id && x !== prev && x !== next && GUIDES[x].module === g.module).slice(0, 3);
  const url = `${SITE_URL}/fix/${id}`;
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: g.title,
    description: g.summary,
    url,
    step: [
      ...g.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s, url: `${url}#step-${i + 1}` })),
      { "@type": "HowToStep", position: g.steps.length + 1, name: "Check it worked", text: g.verify, url: `${url}#verify` },
    ],
  };

  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Fix guides", "/fix"], [g.title, `/fix/${id}`]])} />
      <JsonLd data={howTo} />
      <SiteNav />
      <main>
        <PageHero h1={g.title} lead={g.summary} />
        <section className="sec" aria-label="Guide">
          <div className={`container guide ga-${g.module}`}>
            <nav className="guide-crumbs" aria-label="Breadcrumb">
              <Link href="/fix">Fix guides</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/fix?area=${g.module}`} className="guide-tag">
                <AreaIcon k={g.module} size={15} /> {area}
              </Link>
            </nav>

            <div className="guide-why">
              <h2>Why it matters</h2>
              <p>{g.why}</p>
            </div>

            <h2>Steps</h2>
            <ol className="guide-steps">
              {g.steps.map((s, i) => (
                <li key={s} id={`step-${i + 1}`}>{s}</li>
              ))}
            </ol>

            {g.dev && (
              <>
                <h3>For your developer</h3>
                <CopyCode code={g.dev} />
              </>
            )}

            <div className="guide-verify" id="verify">
              <h2>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Check it worked
              </h2>
              <p>{g.verify}</p>
            </div>

            {g.tool && (
              <Link className="btn" href={g.tool.href}>
                {g.tool.label} <Arrow />
              </Link>
            )}

            <nav className="guide-pn" aria-label="Previous and next guide">
              {prev ? <PnCard id={prev} dir="prev" /> : <span />}
              {next ? <PnCard id={next} dir="next" /> : <span />}
            </nav>

            {related.length > 0 && (
              <section className="guide-related" aria-labelledby="related-h">
                <h2 id="related-h">More {area} guides</h2>
                <ul>
                  {related.map((r) => (
                    <li key={r}>
                      <Link href={`/fix/${r}`}>
                        <span className="gr-ic" aria-hidden="true"><AreaIcon k={g.module} size={18} /></span>
                        <span className="gr-tx">
                          <b>{GUIDES[r].title}</b>
                          <span>{GUIDES[r].summary}</span>
                        </span>
                        <span className="gr-go" aria-hidden="true"><Arrow /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Link href={`/fix?area=${g.module}`} className="guide-all">
              See all {GUIDE_ORDER.length} fix guides <Arrow />
            </Link>
          </div>
        </section>
        <CtaBand title="Not sure if this affects your site?" text="Run a free scan to see exactly which of these your website needs." />
      </main>
      <SiteFooter />
    </>
  );
}

/** One previous/next card: direction, the guide's area and its title. The whole card is the link. */
function PnCard({ id, dir }: { id: string; dir: "prev" | "next" }) {
  const g = GUIDES[id];
  return (
    <Link href={`/fix/${id}`} rel={dir} className={`pn-card ${dir} ga-${g.module}`}>
      <span className="pn-arrow" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d={dir === "prev" ? "M19 12H5m6-6-6 6 6 6" : "M5 12h14m-6-6 6 6-6 6"} />
        </svg>
      </span>
      <span className="pn-tx">
        <small>{dir === "prev" ? "Previous" : "Next"} · {MODULE_NAMES[g.module]}</small>
        <b>{g.title}</b>
      </span>
    </Link>
  );
}
