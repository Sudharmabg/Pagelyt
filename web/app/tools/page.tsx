import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { CATEGORIES, TOOL_LIST } from "./catalog";
import { ToolBrowser } from "./tool-browser";

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
        <PageHero h1="Free tools for a healthier website." lead="Quick checkers and generators for search engines, AI assistants and security. Free with a Pagelyt account.">
          <ul className="tstats" aria-label="At a glance">
            <li><b>{TOOL_LIST.length}</b> free tools</li>
            <li><b>{CATEGORIES.length}</b> categories</li>
            <li><b>0</b> installs</li>
          </ul>
        </PageHero>
        <section className="sec tdir-sec" aria-label="Free tools">
          <div className="container">
            <ToolBrowser tools={TOOL_LIST.map(({ slug, name, blurb, category, kind }) => ({ slug, name, blurb, category, kind }))} categories={CATEGORIES} />
          </div>
        </section>
        <section className="sec ice tsteps-sec" aria-labelledby="tsteps-h">
          <div className="container">
            <h2 className="title" id="tsteps-h">How the free tools work</h2>
            <ol className="tsteps">
              <li><b>Sign in free</b><span>One account opens every tool. No card, nothing to install.</span></li>
              <li><b>Start from your report</b><span>Scanned your site already? Tools fill in your site&rsquo;s details for you.</span></li>
              <li><b>Copy the fix</b><span>Each tool explains what it found and gives you the file or code to paste in.</span></li>
            </ol>
          </div>
        </section>
        <CtaBand title="Want to know what to fix first?" text="Run a free scan and get a prioritised list for your whole site." />
      </main>
      <SiteFooter />
    </>
  );
}
