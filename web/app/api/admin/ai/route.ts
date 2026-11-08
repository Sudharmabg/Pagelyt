import { adminFromRequest } from "@/lib/auth";
import { runSiteAi } from "@/lib/scan/admin";

/* Admin panel: run the AI visibility check for one site now. */
export async function POST(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  const { siteId } = (await req.json().catch(() => ({}))) as { siteId?: string };
  try {
    const out = siteId ? await runSiteAi(siteId) : null;
    return out ? Response.json(out) : Response.json({ error: "Site not found." }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Run failed." }, { status: 502 });
  }
}
