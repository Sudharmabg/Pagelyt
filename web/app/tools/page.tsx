import type { Metadata } from "next";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getScan, live } from "@/lib/scan/store";
import { toolContext } from "@/lib/scan/tools-context";
import { Tools } from "./tools";
import { ToolsGate } from "./tools-gate";

export const metadata: Metadata = {
  title: "Free Website Tools: llms.txt, robots.txt, Schema and Security Headers",
  description: "Free generators for llms.txt, robots.txt, schema markup, search snippet previews and security headers. They run in your browser, so nothing you type is sent anywhere.",
  alternates: { canonical: "/tools" },
};

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ scan?: string | string[] }> }) {
  const { scan } = await searchParams;
  const scanId = typeof scan === "string" ? scan : undefined;
  // Tools for one report open inside that report's dashboard, pre-filled from its site.
  if (scanId && /^[\w-]{1,64}$/.test(scanId)) redirect(`/dashboard/${encodeURIComponent(scanId)}?view=tools`);

  // With accounts switched on, the tools need a sign-in and pre-fill only from the signed-in owner's own report
  // (fetched by the browser with its token). Without Supabase (local development) they stay open, as before.
  let body = <ToolsGate scanId={scanId} />;
  if (!live()) {
    let ctx = null;
    if (scanId) {
      await connection(); // reports live in the database, so render this request fresh
      const found = await getScan(scanId).catch(() => null);
      if (found) ctx = toolContext(found.id, found);
    }
    body = <Tools ctx={ctx} />;
  }

  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Free tools", "/tools"]])} />
      <SiteNav />
      <main>
        <PageHero h1="Free tools for a healthier website." lead="Small generators that fix common findings in minutes. They run in your browser, so nothing you type is sent anywhere." />
        <section className="sec" aria-label="Free tools">
          <div className="container">{body}</div>
        </section>
        <CtaBand title="Want to know what to fix first?" text="Run a free scan and get a prioritised list for your whole site." />
      </main>
      <SiteFooter />
    </>
  );
}
