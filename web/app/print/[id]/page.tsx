import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReportView, type ReportBrand } from "../../r/report-view";
import { firstBrand } from "@/lib/scan/agency";
import { overallScore } from "@/lib/scan/score";
import { emailConfirmed } from "@/lib/owners";
import { getScanRow } from "@/lib/scan/store";
import { AutoPrint } from "./auto-print";
import { readPrint } from "@/lib/google/crypto";
import { canUseGoogle, getCache, getLink, siteForHost } from "@/lib/google/store";
import type { Ga4Ai, Ga4Data } from "@/lib/google/ga4-insights";
import type { AdsAi, AdsData } from "@/lib/google/ads-insights";
import type { GscData } from "@/lib/google/gsc-insights";

/* The branded report laid out for print. Browser Rendering opens this page to make the server PDF, and the
   dashboard's "Save as PDF" opens it with ?auto=1 to print the full report in the browser.
   Private by link like the dashboard (the scan id is the secret), and never indexed. The owner's Google Analytics
   and Google Ads sections are added only with ?g=<pass> signed for this scan (the owner's PDF request or the dashboard's print). */

export const metadata: Metadata = { title: "Website report", robots: { index: false, follow: false } };

export default async function PrintReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string; g?: string }> }) {
  await connection();
  const row = await getScanRow((await params).id);
  if (!row || row.status !== "done" || !row.result) notFound();
  // Locked like the dashboard until the owning account has entered its email code.
  if (row.user_id && !(await emailConfirmed(row.user_id).catch(() => true))) notFound();
  const brand: ReportBrand | null = row.user_id ? await firstBrand(row.user_id).catch(() => null) : null;
  const res = { ...row.result, overall: overallScore(row.result.modules) };
  const sp = await searchParams;
  const auto = sp.auto === "1";
  const google = sp.g && row.user_id ? await googleFor(sp.g, row.id, row.user_id, row.host) : null;
  return (
    <>
      <ReportView brand={brand} res={res} ai={null} showDetails analytics={google?.analytics} ads={google?.ads} />
      {auto && <AutoPrint />}
    </>
  );
}

type Sections = { analytics: { d: Ga4Data; ai: Ga4Ai | null } | null; ads: { d: AdsData; ai: AdsAi | null; gsc: GscData | null } | null };

async function googleFor(pass: string, scanId: string, userId: string, host: string): Promise<Sections | null> {
  try {
    if (!(await readPrint(pass, scanId)) || !(await canUseGoogle(userId))) return null;
    const site = await siteForHost(host, userId);
    const link = site ? await getLink(site.id) : null;
    if (!site || !link) return null;
    const [ga, ai, ads, adsAi, gsc] = await Promise.all([
      link.ga4_property ? getCache<Ga4Data>(site.id, "ga4") : null,
      link.ga4_property ? getCache<Ga4Ai>(site.id, "ga4_ai") : null,
      link.ads_customer ? getCache<AdsData>(site.id, "ads") : null,
      link.ads_customer ? getCache<AdsAi>(site.id, "ads_ai") : null,
      link.ads_customer && link.gsc_property ? getCache<GscData>(site.id, "gsc") : null,
    ]);
    return {
      analytics: ga?.data ? { d: ga.data, ai: ai?.data && ai.data.basedOn === ga.fetched_at ? ai.data : null } : null,
      ads: ads?.data ? { d: ads.data, ai: adsAi?.data && adsAi.data.basedOn === ads.fetched_at ? adsAi.data : null, gsc: gsc?.data ?? null } : null,
    };
  } catch {
    return null;
  }
}
