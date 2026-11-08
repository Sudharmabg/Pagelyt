import { runSiteAi } from "@/lib/scan/admin";

/* For the cron Worker: run the scheduled AI visibility check for one site. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const { siteId } = (await req.json().catch(() => ({}))) as { siteId?: string };
  try {
    const out = siteId ? await runSiteAi(siteId) : null;
    return out ? Response.json(out) : Response.json({ error: "Site not found." }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Run failed." }, { status: 502 });
  }
}
