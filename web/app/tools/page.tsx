import type { Metadata } from "next";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { Tools } from "./tools";

export const metadata: Metadata = {
  title: "Free Website Tools: llms.txt, robots.txt, Schema and Security Headers",
  description: "Free generators for llms.txt, robots.txt, schema markup, search snippet previews and security headers. They run in your browser, so nothing you type is sent anywhere.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Free tools", "/tools"]])} />
      <SiteNav />
      <main>
        <PageHero h1="Free tools for a healthier website." lead="Small generators that fix common findings in minutes. They run in your browser, so nothing you type is sent anywhere." />
        <section className="sec" aria-label="Free tools">
          <div className="container">
            <Tools />
          </div>
        </section>
        <CtaBand title="Want to know what to fix first?" text="Run a free scan and get a prioritised list for your whole site." />
      </main>
      <SiteFooter />
    </>
  );
}
