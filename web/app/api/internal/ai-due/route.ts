import { dueAiSites } from "@/lib/scan/store-ext";
import { live } from "@/lib/scan/store";

/* For the cron Worker: sites whose weekly AI visibility check is due. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorised" }, { status: 401 });
  return Response.json({ sites: live() ? await dueAiSites(2) : [] });
}
