import type { Metadata } from "next";
import { PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHero h1="Sign in to Pagelyt." lead="We’ll email you a one-time link. No password to remember." />
        <section className="sec" aria-label="Sign in">
          <div className="container">
            <LoginForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
