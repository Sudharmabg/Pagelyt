import type { Metadata } from "next";
import { SiteFooter, SiteNav } from "../site-chrome";
import { AdminPanel } from "./admin";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/* The page is public; everything it shows comes from /api/admin/*, which only answers for emails in the Supabase `admins` table. */
export default function AdminPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="sec acct" aria-label="Admin">
          <div className="container">
            <AdminPanel />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
