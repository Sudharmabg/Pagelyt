import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, crumbLd, faqLd } from "../../json-ld";
import { CtaBand, PageHero } from "../../page-shell";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { TOOL_LIST, TOOLS_BY_SLUG, type ToolSlug } from "../catalog";
import { ToolView } from "../tool-view";

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
  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Free tools", "/tools"], [t.name, `/tools/${t.slug}`]])} />
      <JsonLd data={faqLd(t.faq)} />
      <SiteNav />
      <main>
        <PageHero h1={t.h1} lead={t.lead}>
          <p className="tcrumb">
            <Link href="/tools">Free tools</Link> <span aria-hidden="true">›</span> {t.category}
          </p>
        </PageHero>
        <section className="sec" aria-label={t.name}>
          <div className="container">
            <ToolView slug={t.slug} />
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
              <dl className="tfaq">
                {t.faq.map(([q, a]) => (
                  <div key={q}>
                    <dt>{q}</dt>
                    <dd>{a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="container">
            <h2 className="trel-h">More free tools</h2>
            <ul className="tcards">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/tools/${r.slug}`}>
                    <b>{r.name}</b>
                    <span>{r.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <CtaBand title="Want the full picture?" text="This tool checks one thing. A free Pagelyt scan checks speed, SEO, AI readiness, security and more, and tells you what to fix first." />
      </main>
      <SiteFooter />
    </>
  );
}
