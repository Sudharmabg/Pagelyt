import { userFromRequest } from "@/lib/auth";
import { reply } from "@/lib/gotrue";
import { latestScanForUser, live } from "@/lib/scan/store";

/* The signed-in person's newest finished report, for the header's Dashboard link and the home page's
   welcome-back strip. Only the id, site and score: the full report stays behind /dashboard/<id>. */
export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return reply({ error: "Please sign in first." }, 401);
  if (!live()) return reply({ report: null });
  try {
    const row = await latestScanForUser(user.id);
    if (!row) return reply({ report: null });
    return reply({ report: { id: row.id, host: row.host, score: row.result?.overall ?? null, at: row.created_at } });
  } catch {
    return reply({ report: null });
  }
}
