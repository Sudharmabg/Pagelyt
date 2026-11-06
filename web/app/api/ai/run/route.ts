import { userFromRequest } from "@/lib/auth";
import { runPrompts } from "@/lib/ai/run";
import { configuredProviders } from "@/lib/ai/providers";
import { live, rateLimit } from "@/lib/scan/store";
import { canTrackAi, getSiteAi, listPrompts } from "@/lib/scan/store-ext";

/* Which AI systems are switched on (for the UI). */
export async function GET() {
  return Response.json({ providers: configuredProviders() });
}

/* Run one prompt (or all, capped) for a site the signed-in user owns. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!live()) return Response.json({ error: "AI visibility needs Supabase to be configured." }, { status: 501 });
  if (!(await canTrackAi(user.id))) return Response.json({ error: "AI visibility tracking is on the Professional and Business plans." }, { status: 403 });
  if (!(await rateLimit(`ai:${user.id}`, 40, 3600))) return Response.json({ error: "Hourly limit reached. Try again later." }, { status: 429 });

  const { siteId, promptId } = (await req.json().catch(() => ({}))) as { siteId?: string; promptId?: string };
  const site = siteId ? await getSiteAi(siteId, user.id) : null;
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });

  const all = await listPrompts(site.id);
  const prompts = promptId ? all.filter((p) => p.id === promptId) : all;
  if (!prompts.length) return Response.json({ error: "Add a prompt first." }, { status: 400 });
  try {
    return Response.json(await runPrompts(site, prompts));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Run failed." }, { status: 502 });
  }
}
