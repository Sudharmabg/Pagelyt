"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { fetchLatestReport } from "@/lib/use-latest-report";
import { useSignedInUser } from "@/lib/use-signed-in";

/* Sends signed-in people to their newest report, people without one to their account page (which offers a
   first scan), and signed-out visitors to sign in and back here. */
export function OpenLatest() {
  const user = useSignedInUser();
  const router = useRouter();
  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      router.replace("/login?next=%2Fdashboard");
      return;
    }
    let live = true;
    fetchLatestReport(user.id).then((r) => live && router.replace(r ? `/dashboard/${r.id}` : "/account"));
    return () => {
      live = false;
    };
  }, [user, router]);
  return (
    <main className="dash-open">
      <p className="dash-loading" role="status">Opening your dashboard…</p>
    </main>
  );
}
