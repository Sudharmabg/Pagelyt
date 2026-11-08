import { clientIp } from "@/lib/auth";
import { authConfigured, readJson, reply, resendConfirmation } from "@/lib/gotrue";
import { LIMITS, digest, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";
import { checkEmail } from "@/lib/validate";

/* Sends the confirmation email again. Tightly limited (1 a minute, 5 an hour per address), and it always
   answers the same way, so it cannot be used to find out which addresses exist. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  if (body.website) return reply({ ok: true });
  const email = checkEmail(body.email);
  if (!email.ok) return reply({ error: email.error }, 400);

  const limited = await guard(LIMITS.resend(clientIp(req), await digest(email.value)));
  if (limited) return limited;

  await resendConfirmation(email.value, `${new URL(req.url).origin}/auth/verified`);
  return reply({ ok: true });
}
