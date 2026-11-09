import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { emailsOn } from "@/lib/email";
import { emailConfirmed } from "@/lib/owners";
import { siteHistory } from "@/lib/scan/history";
import { finishedAreas, overallScore } from "@/lib/scan/score";
import type { Finding } from "@/lib/scan/types";
import { getScanRow, getShots } from "@/lib/scan/store";
import { Dashboard } from "../dashboard";
import { PendingDashboard } from "../pending";

export const metadata: Metadata = {
  title: "Your website dashboard",
  robots: { index: false, follow: false }, // private-by-link
};

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string | string[] }> }) {
  await connection(); // always render per request: reports live in the database
  const { id } = await params;
  const claim = (await searchParams).new === "1"; // a signed-in visitor's fresh scan: save it to their account when it finishes
  const row = await getScanRow(id);
  if (!row) notFound(); // a real 404 status, rendered by ./not-found.tsx
  // A new account's report stays locked until it enters its email code. Checked here, on the server, so the
  // report never reaches the browser early. (Before migration 0009 the check is unavailable: nothing is locked.)
  const locked = row.user_id ? !(await emailConfirmed(row.user_id).catch(() => true)) : false;
  if (locked || row.status !== "done" || !row.result) {
    // Area scores that are already final, so a reload mid-scan picks up where the live view was.
    const sofar = row.status === "done" && row.result ? row.result.modules : finishedAreas(((row.state as { findings?: Finding[] }).findings) ?? [], row.stage);
    return (
      <PendingDashboard
        id={id}
        host={row.host}
        status={row.status === "done" && !row.result ? "failed" : row.status}
        locked={locked}
        error={row.error}
        stage={row.stage}
        areas={sofar.map((m) => ({ key: m.key, score: m.score }))}
        claim={claim}
      />
    );
  }
  const history = await siteHistory(row).catch(() => []); // saved sites only; others use this browser's history
  // Reports saved before weighted scoring carry the old plain average; recompute so every view agrees.
  const result = { ...row.result, overall: overallScore(row.result.modules) };
  const prevId = result.change?.prevId;
  const shots = result.snapshot?.shot || prevId ? await getShots([id, ...(prevId ? [prevId] : [])]) : {};
  return <Dashboard scan={{ ...result, id }} history={history} savedFixed={Array.isArray(row.fixed) ? row.fixed : null} shots={{ now: shots[id] ?? null, prev: prevId ? (shots[prevId] ?? null) : null }} canEmail={emailsOn()} />;
}
