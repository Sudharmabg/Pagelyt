"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useSignedIn } from "@/lib/use-signed-in";
import type { ToolContext } from "@/lib/scan/tools-context";
import type { ToolSlug } from "./catalog";
import { AiBotChecker, DomainAgeChecker, HreflangChecker, ReviewLink, RobotsTester } from "./checkers";
import { BulkSchemaChecker, RenderedChecker, SitemapGenerator } from "./checkers-bulk";
import { Headers, Llms, Robots, Schema, Serp, type Ctx } from "./tools";

const VIEWS: Record<ToolSlug, (p: { ctx: Ctx }) => React.ReactNode> = {
  "ai-bot-checker": AiBotChecker,
  "llms-txt-generator": Llms,
  "robots-txt-tester": RobotsTester,
  "robots-txt-generator": Robots,
  "hreflang-checker": HreflangChecker,
  "serp-preview": Serp,
  "schema-markup-generator": Schema,
  "security-headers-generator": Headers,
  "domain-age-checker": DomainAgeChecker,
  "google-review-link-generator": ReviewLink,
  "bulk-schema-checker": BulkSchemaChecker,
  "sitemap-generator": SitemapGenerator,
  "raw-vs-rendered-html": RenderedChecker,
};

/* One tool on its own page. Everyone (and search engines) sees it; using it needs an account, so signed-out
   visitors get a read-only preview with example data and a sign-in prompt. Signed in, tools pre-fill from the
   person's latest report. */
export function ToolView({ slug }: { slug: ToolSlug }) {
  const signedIn = useSignedIn();
  const [ctx, setCtx] = useState<ToolContext | null>(null);
  const [loaded, setLoaded] = useState(false);
  const View = VIEWS[slug];

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    (async () => {
      try {
        const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
        const r = await fetch("/api/account/tools-context", { headers: token ? { authorization: `Bearer ${token}` } : {} });
        const j = (await r.json()) as { ctx?: ToolContext | null };
        if (live) setCtx(j.ctx ?? null);
      } catch {
        /* the tools work without pre-filling */
      }
      if (live) setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, [signedIn, slug]);

  if (signedIn && !loaded) return <p className="dash-loading" role="status">Loading your report…</p>;
  if (signedIn) {
    return (
      <div className="tools">
        {ctx && (
          <p className="tctx" role="status">
            Pre-filled from your scan of <b>{ctx.host}</b>. Check everything before you publish it.
          </p>
        )}
        <View key={ctx?.scanId ?? "blank"} ctx={ctx} />
      </div>
    );
  }

  // Signed out, or still checking: a preview that can't be used yet.
  const next = typeof location === "undefined" ? `/tools/${slug}` : location.pathname;
  return (
    <div className="tools">
      {signedIn === false && (
        <div className="tgate" role="note">
          <div>
            <b>Sign in to use this tool. It&rsquo;s free.</b>
            <span>Signed in, it also pre-fills from your latest Pagelyt report. No account yet? <Link href="/">Run a free scan</Link> and create one in a minute.</span>
          </div>
          <Link className="btn" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </div>
      )}
      <fieldset className="tpreview" disabled aria-label="Example (sign in to use)">
        <View ctx={null} />
      </fieldset>
    </div>
  );
}
