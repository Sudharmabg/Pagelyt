import type { Metadata } from "next";
import { OpenLatest } from "./open-latest";

export const metadata: Metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};

/* /dashboard: the signed-in person's newest report. The header's Dashboard button points here. */
export default function Page() {
  return <OpenLatest />;
}
