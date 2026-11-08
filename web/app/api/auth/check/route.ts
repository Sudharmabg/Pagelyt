import { clientIp } from "@/lib/auth";
import { authConfigured, readJson, reply } from "@/lib/gotrue";
import { LIMITS, digest, guard } from "@/lib/ratelimit";
import { live, rest } from "@/lib/scan/store";
import { checkEmail } from "@/lib/validate";

/* "Does this email already have an account?" so the modal can ask for a password or offer sign-up.
   This is the one place that reveals it, so it is rate-limited per IP and per address. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501); // the modal falls back to the plain form
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  if (body.website) return reply({ exists: false }); // honeypot filled in: act like a harmless miss
  const email = checkEmail(body.email);
  if (!email.ok) return reply({ error: email.error }, 400);

  const limited = await guard(LIMITS.check(clientIp(req), await digest(email.value)));
  if (limited) return limited;

  try {
    const exists = await rest<boolean>("rpc/account_exists", { method: "POST", body: JSON.stringify({ p_email: email.value }) });
    return reply({ exists: exists === true });
  } catch {
    return reply({ error: "Sign-in is temporarily unavailable. Please try again shortly." }, 503);
  }
}
