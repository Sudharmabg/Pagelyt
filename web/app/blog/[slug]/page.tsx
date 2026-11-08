import { Arrow } from "../../arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AUTHOR, POSTS, postBySlug, readMins } from "../../blog-data";
import { JsonLd, crumbLd, faqLd } from "../../json-ld";
import { CtaBand, PageHero } from "../../page-shell";
import { SiteFooter, SiteNav } from "../../site-chrome";
import { SITE_URL } from "../../site-config";
import { Body, toc } from "../rich";
import { PostToc } from "../toc";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = postBySlug(slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description,
    keywords: p.keywords,
    authors: [{ name: AUTHOR }],
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: "article", title: p.title, description: p.description, url: `/blog/${p.slug}`, authors: [AUTHOR] },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = postBySlug(slug);
  if (!p) notFound();
  const related = p.related.map(postBySlug).filter((x): x is NonNullable<typeof x> => !!x);
  const contents = toc(p.body);

  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Blog", "/blog"], [p.h1, `/blog/${p.slug}`]])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: p.h1,
          description: p.description,
          keywords: p.keywords.join(", "),
          articleSection: p.tag,
          author: { "@type": "Person", name: AUTHOR },
          publisher: { "@type": "Organization", name: "Pagelyt", logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` } },
          mainEntityOfPage: `${SITE_URL}/blog/${p.slug}`,
          image: `${SITE_URL}/assets/use-upcoming-blog-post.webp`,
        }}
      />
      <JsonLd data={faqLd(p.faq)} />
      <SiteNav />
      <main>
        <PageHero h1={p.h1} lead={p.lead}>
          <p className="post-byline">
            <span className="post-tag">{p.tag}</span> By {AUTHOR} · {readMins(p)} min read
          </p>
        </PageHero>

        <section className="sec">
          <div className="container post-wrap">
            <PostToc items={[...contents, { id: "faq-h", text: "FAQs" }]} />
            <article className="post-body">
              <Body blocks={p.body} />
              <h2 id="faq-h">Frequently asked questions</h2>
              <div className="faq-inline" style={{ marginLeft: 0 }}>
                {p.faq.map(([q, a], i) => (
                  <details className="qd" key={q} open={i === 0}>
                    <summary>
                      {q}
                      <span className="pm" aria-hidden="true" />
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
              <p className="post-author">
                Written by <strong>{AUTHOR}</strong> at Pagelyt.
              </p>
            </article>
          </div>
        </section>

        {related.length > 0 && (
          <section className="sec ice" aria-labelledby="rel-h">
            <div className="container">
              <h2 className="title" id="rel-h">Keep reading</h2>
              <div className="related">
                {related.map((r) => (
                  <Link className="ftile" href={`/blog/${r.slug}`} key={r.slug}>
                    <span className="post-tag">{r.tag}</span>
                    <h3>{r.h1}</h3>
                    <p>{r.lead}</p>
                    <span className="go">Read <Arrow /></span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
