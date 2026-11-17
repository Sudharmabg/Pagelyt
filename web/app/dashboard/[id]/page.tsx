import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { emailConfirmed } from "@/lib/owners";
import { reportProps, teaserOf } from "@/lib/scan/report-props";
import { finishedAreas } from "@/lib/scan/score";
import type { Finding } from "@/lib/scan/types";
import { getScanRow, inviteLocked } from "@/lib/scan/store";
import { Dashboard } from "../dashboard";
import { InviteGate } from "../invite-gate";
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
  // An admin shared this scan and nobody has signed in to it yet: only the scores are sent. The gate signs the
  // visitor in and gives them the report (or shows it to an admin without changing anything).
  if (inviteLocked(row) && row.status === "done" && row.result) return <InviteGate id={id} host={row.host} teaser={teaserOf(row.result)} />;
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
  return <Dashboard {...(await reportProps({ ...row, result: row.result }))} />;
}
