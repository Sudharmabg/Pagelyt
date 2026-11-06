import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, crumbLd } from "../../json-ld";
import { CtaBand, PageHero } from "../../page-shell";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { GUIDES } from "@/lib/scan/guides";
import { MODULE_NAMES } from "@/lib/scan/types";

export const generateStaticParams = () => Object.keys(GUIDES).map((id) => ({ id }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const g = GUIDES[(await params).id];
  if (!g) return {};
  return { title: g.title, description: g.summary, alternates: { canonical: `/fix/${(await params).id}` } };
}

export default async function FixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = GUIDES[id];
  if (!g) notFound();
  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], [g.title, `/fix/${id}`]])} />
      <SiteNav />
      <main>
        <PageHero h1={g.title} lead={g.summary} />
        <section className="sec" aria-label="Guide">
          <div className="container guide">
            <p className="guide-tag">{MODULE_NAMES[g.module]}</p>
            <h2>Steps</h2>
            <ol className="guide-steps">
              {g.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {g.dev && (
              <>
                <h3>For your developer</h3>
                <pre className="guide-code" tabIndex={0}>{g.dev}</pre>
              </>
            )}
            {g.tool && (
              <Link className="btn ghost" href={g.tool.href}>
                {g.tool.label}
              </Link>
            )}
          </div>
        </section>
        <CtaBand title="Not sure if this affects your site?" text="Run a free scan to see exactly which of these your website needs." />
      </main>
      <SiteFooter />
    </>
  );
}
