"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useSignedIn } from "@/lib/use-signed-in";
import type { ToolContext } from "@/lib/scan/tools-context";
import type { ToolSlug } from "./catalog";
import { AiBotChecker, DomainAgeChecker, HreflangChecker, ReviewLink, RobotsTester } from "./checkers";
import { BulkSchemaChecker, RenderedChecker, SitemapGenerator } from "./checkers-bulk";
import { Headers, Llms, Robots, Schema, Serp, type Ctx } from "./tools";
import { LeadModal, type ScanProblem } from "../lead-modal";

/** Every tool's live view, by slug. Also used by the dashboard's Free tools section (`dash-tools.tsx`). */
export const VIEWS: Record<ToolSlug, (p: { ctx: Ctx }) => React.ReactNode> = {
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

/* One tool on its own page. Everyone (and search engines) sees it and can fill it in. Running it needs an
   account: signed out, pressing Check / Generate / Copy opens the same log-in or sign-up modal as the home page,
   and once the visitor is in, the action they pressed carries on with what they typed. Visitors who arrive
   signed in get the tool pre-filled from their latest report. */
export function ToolView({ slug, name }: { slug: ToolSlug; name: string }) {
  const signedIn = useSignedIn();
  const [ctx, setCtx] = useState<ToolContext | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(false);
  const [authed, setAuthed] = useState(false); // signed in through the modal on this page: keep what they typed, don't pre-fill
  const pending = useRef<(() => void) | null>(null); // the action to carry on with once they're in
  const View = VIEWS[slug];

  useEffect(() => {
    if (!signedIn || authed) return;
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
  }, [signedIn, slug, authed]);

  /** Signed out: stop the action, remember it, and ask them to log in or sign up. */
  const gate = (e: React.SyntheticEvent, resume: () => void) => {
    if (signedIn || authed) return;
    e.preventDefault();
    e.stopPropagation();
    pending.current = resume;
    setModal(true);
  };

  const onSubmitCapture = (e: React.FormEvent<HTMLDivElement>) => {
    const form = e.target as HTMLFormElement;
    gate(e, () => form.requestSubmit());
  };
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-gate]");
    if (btn) gate(e, () => btn.click());
  };

  /** The modal calls this once the visitor is signed in: close it and carry on with what they pressed. */
  const resume = async (): Promise<ScanProblem | null> => {
    setAuthed(true);
    setModal(false);
    const go = pending.current;
    pending.current = null;
    window.setTimeout(() => go?.(), 60);
    return null;
  };

  if (signedIn && !authed && !loaded) return <p className="dash-loading" role="status">Loading your report…</p>;
  return (
    <>
      <div className="tools" onSubmitCapture={onSubmitCapture} onClickCapture={onClickCapture}>
        {ctx && (
          <p className="tctx" role="status">
            Pre-filled from your scan of <b>{ctx.host}</b>. Check everything before you publish it.
          </p>
        )}
        <View key={ctx?.scanId ?? "blank"} ctx={ctx} />
      </div>
      {/* outside the wrapper, so the modal's own forms aren't caught by the sign-in gate above */}
      <LeadModal open={modal} url="" host="" tool={name} onClose={() => setModal(false)} onSubmit={resume} />
    </>
  );
}
