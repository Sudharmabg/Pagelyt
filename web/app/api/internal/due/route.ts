import { dueSites } from "@/lib/scan/store";

const authorised = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
};

/* For the cron Worker: sites whose scheduled rescan is due. */
export async function GET(req: Request) {
  if (!authorised(req)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const sites = await dueSites(5);
  return Response.json({ sites: sites.map((s) => ({ id: s.id, host: s.host })) });
}
