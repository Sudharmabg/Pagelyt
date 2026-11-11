import type { Metadata } from "next";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { SITE_URL } from "../site-config";
import { GUIDES, GUIDE_AREAS, GUIDE_ORDER } from "@/lib/scan/guides";
import { MODULE_NAMES } from "@/lib/scan/types";
import { GuideBrowser, type GuideCard } from "./guide-browser";

export const metadata: Metadata = {
  title: "Website Fix Guides: Step-by-Step Help for Common Website Issues",
  description: "Plain-English, step-by-step guides for the most common SEO, security, speed, accessibility, privacy and email problems found on websites.",
  alternates: { canonical: "/fix" },
};

export default function FixIndex() {
  const guides: GuideCard[] = GUIDE_ORDER.map((id) => {
    const g = GUIDES[id];
    return { id, title: g.title, summary: g.summary, module: g.module, steps: g.steps.length, dev: !!g.dev, tool: !!g.tool };
  });
  const areas = GUIDE_AREAS.map((a) => ({ ...a, name: MODULE_NAMES[a.key] }));
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Website fix guides",
    itemListElement: guides.map((g, i) => ({ "@type": "ListItem", position: i + 1, name: g.title, url: `${SITE_URL}/fix/${g.id}` })),
  };
  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Fix guides", "/fix"]])} />
      <JsonLd data={listLd} />
      <SiteNav />
      <main>
        <PageHero
          h1="Fix guides, in plain English."
          lead={`${guides.length} step-by-step guides for the issues a Pagelyt scan finds most often. Why each one matters, what to do, and how to check it worked, with developer notes where you need them.`}
        />
        <section className="sec" aria-label="Guides by area">
          <div className="container">
            <GuideBrowser guides={guides} areas={areas} />
          </div>
        </section>
        <CtaBand title="Find out which of these your site needs." text="Run a free scan and get only the guides that apply to you." />
      </main>
      <SiteFooter />
    </>
  );
}
