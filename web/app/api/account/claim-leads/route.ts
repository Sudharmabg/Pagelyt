import { userFromRequest } from "@/lib/auth";
import { reply } from "@/lib/gotrue";
import { claimScansByEmail, live } from "@/lib/scan/store";

/* Called right after someone confirms their email: scans they started with that address become theirs, so the
   dashboard opens in owner mode on any device. Needs a verified signed-in user (Authorization: Bearer <token>). */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user || !user.email) return reply({ error: "Please sign in first." }, 401);
  if (!user.verified) return reply({ error: "Please confirm your email first." }, 403);
  if (!live()) return reply({ scans: [] });
  try {
    return reply({ scans: await claimScansByEmail(user.id, user.email.toLowerCase()) });
  } catch {
    return reply({ error: "Could not load your reports. Please try again." }, 500);
  }
}
