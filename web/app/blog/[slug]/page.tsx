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
import { fitTitle } from "../../counts";
import { POST_ANSWERS } from "../../answers";
import { QuickAnswer, TopicLinks } from "../../seo-bits";
import { POST_FOCUS, featuresForPost, postsForFeature, toolsForPost } from "../../topics";

/** The post's focus keyword first, then its other keywords without repeats. */
const keywordsFor = (slug: string, kw: string[]) => {
  const all = POST_FOCUS[slug] ? [POST_FOCUS[slug], ...kw] : kw;
  return all.filter((k, i) => all.findIndex((x) => x.toLowerCase() === k.toLowerCase()) === i);
};

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = postBySlug(slug);
  if (!p) return {};
  return {
    title: fitTitle(p.title),
    description: p.description,
    keywords: keywordsFor(p.slug, p.keywords),
    authors: [{ name: AUTHOR }],
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: "article", title: p.title, description: p.description, url: `/blog/${p.slug}`, authors: [AUTHOR] },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = postBySlug(slug);
  if (!p) notFound();
  const contents = toc(p.body);
  const answer = POST_ANSWERS[p.slug];
  const focus = POST_FOCUS[p.slug];
  const features = featuresForPost(p.slug);
  // The post's own picks first, then other posts on its main topic, so every post links to its neighbours.
  const related = [...new Set([...p.related, ...(features[0] ? postsForFeature(features[0]) : [])])]
    .filter((s) => s !== p.slug)
    .slice(0, 4)
    .map(postBySlug)
    .filter((x): x is NonNullable<typeof x> => !!x);
  const tools = toolsForPost(p.slug);

  return (
    <>
      <JsonLd data={crumbLd([["Home", "/"], ["Blog", "/blog"], [p.h1, `/blog/${p.slug}`]])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: p.title,
          alternativeHeadline: p.h1,
          description: p.description,
          ...(answer ? { abstract: answer } : {}),
          keywords: keywordsFor(p.slug, p.keywords).join(", "),
          ...(focus ? { about: { "@type": "Thing", name: focus } } : {}),
          inLanguage: "en",
          isAccessibleForFree: true,
          url: `${SITE_URL}/blog/${p.slug}`,
          isPartOf: { "@type": "Blog", name: "Pagelyt blog", url: `${SITE_URL}/blog` },
          mentions: [
            ...features.map((f) => ({ "@type": "WebPage", url: `${SITE_URL}/features/${f}` })),
            ...tools.map((t) => ({ "@type": "WebApplication", url: `${SITE_URL}/tools/${t}` })),
          ],
          relatedLink: related.map((r) => `${SITE_URL}/blog/${r.slug}`),
          articleSection: p.tag,
          author: { "@type": "Person", name: AUTHOR },
          publisher: { "@type": "Organization", name: "Pagelyt", logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` } },
          mainEntityOfPage: `${SITE_URL}/blog/${p.slug}`,
          image: `${SITE_URL}/blog/${p.slug}/opengraph-image`,
        }}
      />
      <JsonLd data={faqLd(p.faq)} />
      <SiteNav />
      <main>
        <PageHero h1={p.h1} lead={p.lead}>
          <p className="post-byline">
            <span className="post-tag">{p.tag}</span> By {AUTHOR} · {readMins(p)} min read
          </p>
          <QuickAnswer text={answer} label="The short answer" />
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

        <TopicLinks features={features} tools={tools} title="Check it on your own site" lead="Pagelyt checks this in every scan, and the free tools below check one thing in seconds." />

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
