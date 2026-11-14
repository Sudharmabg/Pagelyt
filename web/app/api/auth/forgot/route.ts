import { clientIp } from "@/lib/auth";
import { authConfigured, readJson, recover, reply } from "@/lib/gotrue";
import { LIMITS, digest, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";
import { checkEmail } from "@/lib/validate";

/* "Forgot password", step 1: emails a 6-digit reset code (step 2 is /api/auth/reset). Tightly limited (1 a minute, 5 an hour per address) and it always
   answers the same way, so it cannot be used to find out which addresses have an account. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  if (body.website) return reply({ ok: true });
  const email = checkEmail(body.email);
  if (!email.ok) return reply({ error: email.error }, 400);

  const limited = await guard(LIMITS.forgot(clientIp(req), await digest(email.value)));
  if (limited) return limited;

  await recover(email.value, `${new URL(req.url).origin}/auth/reset`);
  return reply({ ok: true });
}
