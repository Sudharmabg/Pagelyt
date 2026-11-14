import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { ManageBooking } from "./manage";

export const metadata: Metadata = {
  title: "Your Consultation Booking",
  robots: { index: false, follow: false },
};

/* The link in a booking confirmation email: shows the booking and lets the visitor cancel it. */
export default async function ManagePage({ searchParams }: { searchParams: Promise<{ id?: string | string[]; t?: string | string[] }> }) {
  const q = await searchParams;
  const one = (v?: string | string[]) => (typeof v === "string" ? v : "");
  return (
    <>
      <SiteNav />
      <main className="sec">
        <div className="container bk-manage">
          <ManageBooking id={one(q.id)} t={one(q.t)} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
