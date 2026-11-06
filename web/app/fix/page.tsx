import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { AreaIcon } from "../dashboard/icons";
import { GUIDES } from "@/lib/scan/guides";
import { MODULE_NAMES, type ModuleKey } from "@/lib/scan/types";

export const metadata: Metadata = {
  title: "Website Fix Guides: Step-by-Step Help for Common Website Issues",
  description: "Plain-English, step-by-step guides for the most common SEO, security, speed, accessibility, privacy and email problems found on websites.",
  alternates: { canonical: "/fix" },
};

export default function FixIndex() {
  const groups = new Map<ModuleKey, [string, string][]>();
  for (const [id, g] of Object.entries(GUIDES)) groups.set(g.module, [...(groups.get(g.module) ?? []), [id, g.title]]);
  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Fix guides", "/fix"]])} />
      <SiteNav />
      <main>
        <PageHero h1="Fix guides, in plain English." lead="Step-by-step help for the issues a Pagelyt scan finds most often. No jargon, with developer notes where you need them." />
        <section className="sec" aria-label="Guides by area">
          <div className="container guides-grid">
            {[...groups].map(([mod, list]) => (
              <div key={mod} className="guides-col">
                <h2><AreaIcon k={mod} size={20} /> {MODULE_NAMES[mod]}</h2>
                <ul>
                  {list.map(([id, title]) => (
                    <li key={id}><Link href={`/fix/${id}`}>{title}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        <CtaBand title="Find out which of these your site needs." text="Run a free scan and get only the guides that apply to you." />
      </main>
      <SiteFooter />
    </>
  );
}
