import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { siteHistory } from "@/lib/scan/history";
import { getScanRow } from "@/lib/scan/store";
import { Dashboard } from "../dashboard";

export const metadata: Metadata = {
  title: "Your website dashboard",
  robots: { index: false, follow: false }, // private-by-link
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // always render per request: reports live in the database
  const { id } = await params;
  const row = await getScanRow(id);
  if (!row || row.status !== "done" || !row.result) notFound(); // a real 404 status, rendered by ./not-found.tsx
  const history = await siteHistory(row).catch(() => []); // saved sites only; others use this browser's history
  return <Dashboard scan={{ ...row.result, id }} history={history} />;
}
