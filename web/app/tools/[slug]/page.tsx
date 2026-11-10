import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, crumbLd, faqLd } from "../../json-ld";
import { CtaBand, PageHero } from "../../page-shell";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { TOOL_LIST, TOOLS_BY_SLUG, type ToolSlug } from "../catalog";
import { TONE, ToolIcon } from "../icons";
import { ToolView } from "../tool-view";
import { Arrow } from "../../arrow";

const STEPS: Record<"checker" | "generator", [string, string][]> = {
  checker: [
    ["Enter an address", "Your site, a competitor's, or any public page."],
    ["We check it live", "Our server fetches it the way search engines and bots do."],
    ["Read what to fix", "Each problem comes with the reason and the fix."],
  ],
  generator: [
    ["Fill in the details", "Signed in, we pre-fill them from your latest report."],
    ["Preview the result", "See exactly what will be published as you type."],
    ["Copy or download", "Paste it into your site, or send it to your developer."],
  ],
};

export function generateStaticParams() {
  return TOOL_LIST.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const t = TOOLS_BY_SLUG.get((await params).slug as ToolSlug);
  if (!t) return {};
  return {
    title: t.title,
    description: t.description,
    alternates: { canonical: `/tools/${t.slug}` },
    openGraph: { title: t.title, description: t.description, url: `/tools/${t.slug}` },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = TOOLS_BY_SLUG.get((await params).slug as ToolSlug);
  if (!t) notFound();
  const related = TOOL_LIST.filter((x) => x.category === t.category && x.slug !== t.slug).concat(TOOL_LIST.filter((x) => x.category !== t.category)).slice(0, 3);
  const tone = TONE[t.category];
  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Free tools", "/tools"], [t.name, `/tools/${t.slug}`]])} />
      <JsonLd data={faqLd(t.faq)} />
      <SiteNav />
      <main>
        <PageHero h1={t.h1} lead={t.lead}>
          <nav className="tcrumb" aria-label="Breadcrumb">
            <Link href="/tools">Free tools</Link> <span aria-hidden="true">›</span> <span>{t.category}</span>
          </nav>
          <div className={`thero-badges ${tone}`}>
            <span className="thero-ic"><ToolIcon slug={t.slug} size={28} /></span>
            <span className="thero-chip">{t.category}</span>
            <span className="thero-chip plain">{t.kind === "checker" ? "Checker" : "Generator"}</span>
            <span className="thero-chip plain">Free</span>
          </div>
        </PageHero>
        <section className="sec tool-sec" aria-label={t.name}>
          <div className="container">
            <div className={`tshell ${tone}`}>
              <div className="tshell-head">
                <span className="tshell-ic"><ToolIcon slug={t.slug} size={20} /></span>
                <b>{t.name}</b>
                <small>{t.kind === "checker" ? "We fetch the site from our server" : "Runs in your browser"}</small>
              </div>
              <div className="tshell-body">
                <ToolView slug={t.slug} />
              </div>
            </div>
            <ol className="tsteps compact" aria-label="How it works">
              {STEPS[t.kind].map(([h, p]) => (
                <li key={h}><b>{h}</b><span>{p}</span></li>
              ))}
            </ol>
          </div>
        </section>
        <section className="sec tabout" aria-labelledby="tool-about-h">
          <div className="container tabout-grid">
            <div>
              <h2 id="tool-about-h">Why it matters</h2>
              {t.about.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
            </div>
            <div>
              <h2>Questions</h2>
              <div className="tfaq">
                {t.faq.map(([q, a], i) => (
                  <details key={q} open={i === 0}>
                    <summary>{q}</summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
          <div className="container">
            <h2 className="trel-h">More free tools</h2>
            <ul className="tgrid2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/tools/${r.slug}`} className={`tcard ${TONE[r.category]}`}>
                    <span className="tcard-ic"><ToolIcon slug={r.slug} /></span>
                    <span className="tcard-kind">{r.kind === "checker" ? "Checker" : "Generator"}</span>
                    <b>{r.name}</b>
                    <span className="tcard-txt">{r.blurb}</span>
                    <span className="tcard-go">Open tool <Arrow /></span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="tall"><Link href="/tools">See all {TOOL_LIST.length} free tools <Arrow /></Link></p>
          </div>
        </section>
        <CtaBand title="Want the full picture?" text="This tool checks one thing. A free Pagelyt scan checks speed, SEO, AI readiness, security and more, and tells you what to fix first." />
      </main>
      <SiteFooter />
    </>
  );
}
