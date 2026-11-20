import { clientIp, userFromRequest } from "@/lib/auth";
import { authConfigured, readJson, reply, updateUserMeta } from "@/lib/gotrue";
import { LIMITS, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";
import { checkName } from "@/lib/validate";

/* Saves the account's name: the "What should we call you?" step after a Google or GitHub sign-up whose profile had
   none. Written to user_metadata.name (what the app reads) and to app_metadata.name, the copy only the server can
   write, which /api/auth/oauth uses to put the name back if a later Google or GitHub sign-in overwrites it. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const user = await userFromRequest(req);
  if (!user) return reply({ error: "Please sign in again." }, 401);
  const body = await readJson(req);
  const name = checkName(body?.name);
  if (!name.ok) return reply({ error: name.error }, 400);
  const limited = await guard(LIMITS.password(clientIp(req), user.id));
  if (limited) return limited;
  if (!(await updateUserMeta(user.id, { user_metadata: { name: name.value }, app_metadata: { name: name.value } }))) {
    return reply({ error: "We couldn't save your name just now. Please try again." }, 503);
  }
  return reply({ ok: true });
}
