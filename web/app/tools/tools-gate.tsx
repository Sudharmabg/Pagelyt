"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useSignedIn } from "@/lib/use-signed-in";
import type { ToolContext } from "@/lib/scan/tools-context";
import { Tools } from "./tools";

/* The free tools are for signed-in visitors. Once signed in they pre-fill from the person's own latest report.
   (The generators run in the browser, so this gate is about accounts and leads; the report data that pre-fills
   them is only ever returned to its owner by the server.) */
export function ToolsGate({ scanId }: { scanId?: string }) {
  const signedIn = useSignedIn();
  const [ctx, setCtx] = useState<ToolContext | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    (async () => {
      const sb = supabaseBrowser();
      const token = (await sb?.auth.getSession())?.data.session?.access_token;
      try {
        const r = await fetch(`/api/account/tools-context${scanId ? `?scan=${encodeURIComponent(scanId)}` : ""}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
        const j = (await r.json()) as { ctx?: ToolContext | null };
        if (live) setCtx(j.ctx ?? null);
      } catch {
        /* the tools still work without pre-filling */
      }
      if (live) setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, [signedIn, scanId]);

  if (signedIn === undefined) return <p className="dash-loading" role="status">Loading…</p>;

  if (!signedIn) {
    const next = `/tools${scanId ? `?scan=${encodeURIComponent(scanId)}` : ""}`;
    return (
      <div className="panel auth-card">
        <h2>Sign in to use the free tools</h2>
        <p className="panel-note">The generators are free for everyone with an account. Signed in, they also pre-fill from your latest report.</p>
        <Link className="btn" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        <p className="panel-note">No account yet? <Link href="/">Run a free scan</Link> and create one in a minute.</p>
      </div>
    );
  }

  if (!loaded) return <p className="dash-loading" role="status">Loading your report…</p>;
  return <Tools ctx={ctx} />;
}
