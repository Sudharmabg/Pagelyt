import { adminFromRequest } from "@/lib/auth";
import { adminHostDetail, adminInvites, adminWebsites } from "@/lib/scan/admin-data";

/* Admin panel: every scanned website with the emails attached to it; `?host=` gives one website's scores and past
   scans; `?shared=1` lists the scans admins made to share (Scan tab). */
export async function GET(req: Request) {
  const a = await adminFromRequest(req);
  if ("error" in a) return a.error;
  const sp = new URL(req.url).searchParams;
  try {
    if (sp.get("shared")) return Response.json(await adminInvites());
    const host = sp.get("host");
    if (host) {
      const detail = await adminHostDetail(host);
      return detail ? Response.json(detail) : Response.json({ error: "No scans for that website." }, { status: 404 });
    }
    return Response.json({ websites: await adminWebsites() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not load websites." }, { status: 503 });
  }
}
