import type { Metadata } from "next";
import { JsonLd, crumbLd } from "../json-ld";
import { PageHero } from "../page-shell";
import { CONTACT_EMAIL } from "../site-config";
import { SiteFooter, SiteNav } from "../site-chrome";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Pagelyt collects, uses and protects information when you analyse a website or contact us.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <JsonLd
        data={crumbLd([
          ["Home", "/"],
          ["Privacy Policy", "/privacy"],
        ])}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="Privacy Policy."
          lead="Last updated 13 November 2026. This page explains what Pagelyt collects and why."
        />
        <section className="sec">
          <div className="container legal">
            <h2>Information we collect</h2>
            <ul>
              <li>Website addresses you submit for analysis, and the public results we measure from them.</li>
              <li>Contact details you give us, such as your name and email address, when you write to us or request a consultation.</li>
              <li>Account and billing details when paid plans are available.</li>
              <li>Basic usage data, such as pages visited and device type, to keep the service reliable.</li>
            </ul>
            <h2>How we use it</h2>
            <p>
              We use this information to run analyses, produce reports, send you the updates you ask for, answer
              messages, improve Pagelyt and keep it secure. We do not sell your personal information.
            </p>
            <h2>Website analysis</h2>
            <p>
              Pagelyt reads publicly available pages of the website you submit. Some features need your permission or
              access, such as analytics or Google Search Console connections. We only use that access for the features
              you turn on.
            </p>
            <h2>Google user data</h2>
            <p>
              If you choose Connect Google, Pagelyt asks for read-only access to Google Search Console and your Google
              account&rsquo;s email address. We read search performance (clicks, impressions, click rate and position by
              page and search) and Google&rsquo;s index status for your site&rsquo;s pages, and show them next to your
              report&rsquo;s findings, in your dashboard and in answers from the Pagelyt Assistant. If you also connect
              Google Analytics, we ask for read-only Analytics access and read visits, engaged visits, page views and
              traffic sources by page for your site&rsquo;s property, and show them in your dashboard and your downloaded
              PDF report. We cannot change anything in your Google account.
            </p>
            <p>
              We store your Google refresh token encrypted and a copy of the latest numbers for each site, refreshed
              about once a day while you use Pagelyt. Disconnect Google on your account page at any time: we revoke our
              access at Google and delete the token and the stored data. You can also remove access in your Google
              Account under Security, Third-party connections.
            </p>
            <p>
              Pagelyt&rsquo;s use and transfer of information received from Google APIs follows the{" "}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
              including the Limited Use requirements. We use Google data only to provide the features you see. We do not
              sell it, use it for advertising, or let people read it except with your permission, for security, or where
              the law requires it. We do not use it to train AI models. When you ask the Pagelyt Assistant a question,
              or press Analyse with AI on the Analytics tab, a summary of these numbers and your report&rsquo;s findings
              is sent to our AI provider (OpenAI) only to write that answer or those insights for you.
            </p>
            <h2>Sharing</h2>
            <p>
              We share information only with service providers that help us run Pagelyt, such as hosting, email and
              payment providers, and where the law requires it.
            </p>
            <h2>Retention and your choices</h2>
            <p>
              We keep information for as long as needed to provide the service or meet legal duties. You can ask to
              see, correct or delete your information at any time.
            </p>
            <h2>Contact</h2>
            <p>
              For privacy questions or requests, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
