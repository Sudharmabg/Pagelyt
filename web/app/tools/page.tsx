import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { CATEGORIES, TOOL_LIST } from "./catalog";

export const metadata: Metadata = {
  title: "Free SEO and AI Visibility Tools: robots.txt, llms.txt, hreflang, Schema and More",
  description: "Free website tools: AI bot access checker, robots.txt tester and generator, llms.txt generator, hreflang checker, schema markup, search preview, security headers, domain age and Google review links.",
  alternates: { canonical: "/tools" },
};

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ scan?: string | string[] }> }) {
  const { scan } = await searchParams;
  // Tools for one report open inside that report's dashboard, pre-filled from its site.
  if (typeof scan === "string" && /^[\w-]{1,64}$/.test(scan)) redirect(`/dashboard/${encodeURIComponent(scan)}?view=tools`);

  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Free tools", "/tools"]])} />
      <SiteNav />
      <main>
        <PageHero h1="Free tools for a healthier website." lead={`${TOOL_LIST.length} quick checkers and generators for search, AI assistants and security. Free with a Pagelyt account.`} />
        <section className="sec" aria-label="Free tools">
          <div className="container tdir">
            {CATEGORIES.map((c, i) => {
              const list = TOOL_LIST.filter((t) => t.category === c.name);
              if (!list.length) return null;
              return (
                <section key={c.name} className="tdir-group" aria-labelledby={`cat-${i}`}>
                  <h2 id={`cat-${i}`}>{c.name}</h2>
                  <p className="tdir-lead">{c.text}</p>
                  <ul className="tcards">
                    {list.map((t) => (
                      <li key={t.slug}>
                        <Link href={`/tools/${t.slug}`}>
                          <b>{t.name}</b>
                          <span>{t.blurb}</span>
                          <i>{t.kind === "checker" ? "Checker" : "Generator"}</i>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </section>
        <CtaBand title="Want to know what to fix first?" text="Run a free scan and get a prioritised list for your whole site." />
      </main>
      <SiteFooter />
    </>
  );
}
