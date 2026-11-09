import { Suspense } from "react";
import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { ScrollTop } from "./scroll-top";
import { SITE_NAME, SITE_URL } from "./site-config";

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const TITLE = "Free AI-Powered Website Audit: SEO, Speed, Security & GEO";
const DESCRIPTION =
  "Free AI-powered website audit from one URL. Check SEO, speed, Core Web Vitals, security, accessibility and GEO for AI search, with fixes ranked by impact.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${TITLE} | ${SITE_NAME}`, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${TITLE} | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: `${TITLE} | ${SITE_NAME}`, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Suspense fallback={null}>
          <ScrollTop />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
