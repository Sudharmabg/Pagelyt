import { runPrompts } from "@/lib/ai/run";
import { bumpAiSchedule, getSiteAi, listPrompts } from "@/lib/scan/store-ext";

/* For the cron Worker: run the scheduled AI visibility check for one site. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const { siteId } = (await req.json().catch(() => ({}))) as { siteId?: string };
  const site = siteId ? await getSiteAi(siteId) : null;
  if (!site) return Response.json({ error: "Site not found." }, { status: 404 });
  await bumpAiSchedule(site.id); // first, so a failing run is not retried every minute
  const prompts = await listPrompts(site.id);
  if (!prompts.length) return Response.json({ runs: 0 });
  try {
    return Response.json(await runPrompts(site, prompts));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Run failed." }, { status: 502 });
  }
}
