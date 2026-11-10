import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReportView } from "../report-view";
import { loadSharedReport, getSiteAi, recentRuns } from "@/lib/scan/store-ext";
import { visibilityScore } from "@/lib/ai/analyse";
import { providerLabel } from "@/lib/ai/providers";

/* The client-facing, white-label report. No Pagelyt navigation or footer; the agency's brand leads.
   Anyone with the link can open it, so it is noindex and the token is long and unguessable. */

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const r = await loadSharedReport((await params).token);
  const brand = r?.brand?.name;
  const host = r?.scan.host;
  // "Acme Digital: website report", or without a brand "Website report: example.com" (never "Website report: website report").
  const title = brand ? `${brand}: website report` : host ? `Website report: ${host}` : "Website report";
  return { title: { absolute: title }, robots: { index: false, follow: false }, openGraph: { siteName: brand ?? "Website report", title } };
}

export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const r = await loadSharedReport((await params).token);
  if (!r) notFound();
  const { share, brand, scan } = r;
  const res = scan.result;
      
  let ai: { score: number | null; byProvider: { label: string; score: number | null }[]; prompts: number } | null = null;
  if (share.include_ai && scan.site_id) {
    const site = await getSiteAi(scan.site_id, share.user_id);
    if (site) {
      const runs = await recentRuns(site.id, 300);
      const latest = new Map<string, (typeof runs)[number]>();
      for (const x of runs) if (!latest.has(`${x.prompt_id}:${x.provider}`)) latest.set(`${x.prompt_id}:${x.provider}`, x);
      const list = [...latest.values()];
      if (list.length) {
        const providers = [...new Set(list.map((x) => x.provider))];
        ai = {
          score: visibilityScore(list),
          byProvider: providers.map((p) => ({ label: providerLabel(p), score: visibilityScore(list.filter((x) => x.provider === p)) })),
          prompts: new Set(list.map((x) => x.prompt_id)).size,
        };
      }
    }
  }

  return <ReportView brand={brand} res={res} ai={ai} showDetails={share.show_details} pdfToken={share.token} />;
}
