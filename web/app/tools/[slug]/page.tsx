import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, crumbLd, faqLd } from "../../json-ld";
import { CtaBand, PageHero } from "../../page-shell";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { TOOL_LIST, TOOLS_BY_SLUG, type ToolSlug } from "../catalog";
import { TONE, ToolIcon } from "../icons";
import { ToolView } from "../tool-view";
import { ToolSample } from "../samples";
import { ToolSteps } from "../tool-steps";

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

/* "What you'll get", next to the example result. */
const GET: Record<"checker" | "generator", { title: string; points: string[] }> = {
  checker: {
    title: "A clear answer in seconds.",
    points: ["A pass, warning or fail for every check", "The evidence behind each result", "What to change, in plain English"],
  },
  generator: {
    title: "A ready-to-use file, no code needed.",
    points: ["A live preview as you fill it in", "Copy or download in one click", "Hand it to your developer, or paste it in yourself"],
  },
};

/* One small line icon per "Why it matters" point (24px grid, currentColor). */
const WHY_ICONS = [
  <svg key="a" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>,
  <svg key="b" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>,
  <svg key="c" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>,
];

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
            <span className="thero-chip plain">{t.paid ? "Paid plans" : "Free"}</span>
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
                <ToolView slug={t.slug} name={t.name} />
              </div>
            </div>

            <div className={`tget ${tone}`}>
              <div className="tget-copy">
                <span className="tget-eyebrow">What you&rsquo;ll get</span>
                <h2>{GET[t.kind].title}</h2>
                <ul>
                  {GET[t.kind].points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <div className="tget-sample">
                <span className="tget-tag">Example result</span>
                <ToolSample slug={t.slug} />
              </div>
            </div>

            <div className={`tline-wrap ${tone}`}>
              <h2 className="tline-h">How it works</h2>
              <ToolSteps steps={STEPS[t.kind]} />
            </div>
          </div>
        </section>

        <section className={`sec tabout ${tone}`} aria-labelledby="tool-about-h">
          <div className="container tabout-grid">
            <div>
              <h2 id="tool-about-h">Why it matters</h2>
              <ul className="twhy">
                {t.about.map((p, i) => (
                  <li key={p.slice(0, 24)}>
                    <span className="twhy-ic" aria-hidden="true">{WHY_ICONS[i % WHY_ICONS.length]}</span>
                    <p>{p}</p>
                  </li>
                ))}
              </ul>
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
        </section>
        <CtaBand title="Want the full picture?" text="This tool checks one thing. A free Pagelyt scan checks speed, SEO, AI readiness, security and more, and tells you what to fix first." />
      </main>
      <SiteFooter />
    </>
  );
}
