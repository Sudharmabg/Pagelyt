import { clientIp } from "@/lib/auth";
import { authConfigured, readJson, recover, reply } from "@/lib/gotrue";
import { LIMITS, digest, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";
import { checkEmail } from "@/lib/validate";

/* "Forgot password", step 1: emails a 6-digit reset code (step 2 is /api/auth/reset). Tightly limited (1 a minute, 5 an hour per address) Known and unknown
   addresses get the same answer (Supabase's too), so it can't reveal who has an account; a send failure says so. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  if (body.website) return reply({ ok: true });
  const email = checkEmail(body.email);
  if (!email.ok) return reply({ error: email.error }, 400);

  const limited = await guard(LIMITS.forgot(clientIp(req), await digest(email.value)));
  if (limited) return limited;

  const sent = await recover(email.value, `${new URL(req.url).origin}/auth/reset`);
  if (sent === "limited") return reply({ error: "Too many reset emails were sent just now. Please wait a few minutes and try again." }, 429);
  if (sent === "failed") return reply({ error: "We couldn't send the email just now. Please try again in a few minutes, or contact us if it keeps happening." }, 503);
  return reply({ ok: true });
}
