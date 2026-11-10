"use client";

import Link from "next/link";
import { useLatestReport } from "@/lib/use-latest-report";
import { firstName, useSignedInUser } from "@/lib/use-signed-in";
import { Arrow } from "./arrow";

const tone = (s: number) => (s >= 80 ? "good" : s >= 50 ? "ok" : "bad");

/* Home page, signed in: a bar above the headline that takes people straight back to their report.
   Nothing renders for visitors, so the page they see is unchanged. */
export function WelcomeBack() {
  const user = useSignedInUser();
  const report = useLatestReport();
  if (!user) return null;
  return (
    <div className="wb" role="region" aria-label="Your Pagelyt account">
      <span className="acct-av" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
      <div className="wb-txt">
        <b>Welcome back, {firstName(user.name)}.</b>
        {report === undefined ? (
          <span>Finding your latest report…</span>
        ) : report ? (
          <span>
            Latest report: <strong>{report.host}</strong>
            {report.score !== null && <em className={`wb-score ${tone(report.score)}`}>{report.score}/100</em>}
          </span>
        ) : (
          <span>You haven&rsquo;t scanned a site yet. Paste one below to get your first report.</span>
        )}
      </div>
      <Link className="btn sm" href={report ? `/dashboard/${report.id}` : report === null ? "/account" : "/dashboard"}>
        {report === null ? "Your account" : "Open dashboard"} <Arrow />
      </Link>
    </div>
  );
}
