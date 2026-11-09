import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReportView, type ReportBrand } from "../../r/report-view";
import { firstBrand } from "@/lib/scan/agency";
import { overallScore } from "@/lib/scan/score";
import { emailConfirmed } from "@/lib/owners";
import { getScanRow } from "@/lib/scan/store";

/* The branded report laid out for print. Browser Rendering opens this page to make the server PDF.
   Private by link like the dashboard (the scan id is the secret), and never indexed. */

export const metadata: Metadata = { title: "Website report", robots: { index: false, follow: false } };

export default async function PrintReport({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const row = await getScanRow((await params).id);
  if (!row || row.status !== "done" || !row.result) notFound();
  // Locked like the dashboard until the owning account has entered its email code.
  if (row.user_id && !(await emailConfirmed(row.user_id).catch(() => true))) notFound();
  const brand: ReportBrand | null = row.user_id ? await firstBrand(row.user_id).catch(() => null) : null;
  const res = { ...row.result, overall: overallScore(row.result.modules) };
  return <ReportView brand={brand} res={res} ai={null} showDetails />;
}
