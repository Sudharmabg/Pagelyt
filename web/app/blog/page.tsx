import { Arrow } from "../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { AUTHOR, POSTS, readMins } from "../blog-data";
import { JsonLd, crumbLd } from "../json-ld";
import { CtaBand, PageHero } from "../page-shell";
import { SiteFooter, SiteNav } from "../site-chrome";
import { SITE_URL } from "../site-config";

export const metadata: Metadata = {
  title: "Pagelyt Blog: Website Speed, SEO, GEO, Security and Accessibility Guides",
  description:
    "Plain-English guides to website speed, Core Web Vitals, technical SEO, GEO and AI search, website security and accessibility, by the team behind Pagelyt.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "Pagelyt Blog", url: "/blog" },
};

export default function BlogIndex() {
  const [lead, ...rest] = POSTS;
  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Blog", "/blog"]])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Pagelyt Blog",
          url: `${SITE_URL}/blog`,
          blogPost: POSTS.map((p) => ({
            "@type": "BlogPosting",
            headline: p.h1,
            url: `${SITE_URL}/blog/${p.slug}`,
            author: { "@type": "Person", name: AUTHOR },
          })),
        }}
      />
      <SiteNav />
      <main>
        <PageHero
          h1="The Pagelyt blog."
          lead="Plain-English guides to making your website faster, easier to find in search and AI answers, safer and more accessible."
        />
        <section className="sec" aria-label="Posts">
          <div className="container">
            <Link className="post-feature" href={`/blog/${lead.slug}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/use-upcoming-blog-post.webp" alt="" width={1024} height={683} />
              <div>
                <span className="post-tag">{lead.tag}</span>
                <h2>{lead.h1}</h2>
                <p>{lead.lead}</p>
                <span className="post-meta">
                  By {AUTHOR} · {readMins(lead)} min read
                </span>
                <span className="go">Read the guide <Arrow /></span>
              </div>
            </Link>
            <div className="post-grid">
              {rest.map((p) => (
                <Link className="ftile" href={`/blog/${p.slug}`} key={p.slug}>
                  <span className="post-tag">{p.tag}</span>
                  <h3>{p.h1}</h3>
                  <p>{p.lead}</p>
                  <span className="post-meta">
                    By {AUTHOR} · {readMins(p)} min read
                  </span>
                  <span className="go">Read <Arrow /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
