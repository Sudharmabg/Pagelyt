import type { Metadata } from "next";
import { PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

/** Only same-site paths are accepted as a place to go after signing in (never another site). */
function safeNext(value: string | string[] | undefined): string {
  return typeof value === "string" && /^\/(?![/\\])[\w\-./?=&%]*$/.test(value) ? value : "/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; forgot?: string | string[] }> }) {
  const { next, forgot } = await searchParams;
  return (
    <>
      <SiteNav />
      <main>
        <PageHero h1="Sign in to Pagelyt." lead="Use the email and password you chose when you ran your first scan." />
        <section className="sec auth-sec" aria-label="Sign in">
          <div className="container">
            <LoginForm next={safeNext(next)} startForgot={forgot === "1"} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
