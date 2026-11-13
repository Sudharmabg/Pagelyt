import { userFromRequest } from "@/lib/auth";
import { disconnect } from "@/lib/google/store";
import { live } from "@/lib/scan/store";

/* POST: revokes Pagelyt's access at Google and deletes the stored token, property links and cached data. */

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (live()) await disconnect(user.id);
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
