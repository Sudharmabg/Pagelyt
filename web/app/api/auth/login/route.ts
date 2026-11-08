import { clientIp, verifyTurnstile } from "@/lib/auth";
import { authConfigured, readJson, reply, signInWithPassword } from "@/lib/gotrue";
import { LIMITS, digest, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";
import { checkEmail } from "@/lib/validate";

const WRONG = "Email or password is incorrect.";

/* Password sign-in. Guesses are limited per address and per IP, and the endpoint blocks (rather than lets
   everyone through) if the limiter is down. Wrong email and wrong password give the same answer. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  if (body.website) return reply({ error: WRONG }, 401);
  const email = checkEmail(body.email);
  if (!email.ok) return reply({ error: WRONG }, 401);
  const password = body.password;
  if (typeof password !== "string" || password.length === 0 || new TextEncoder().encode(password).length > 200) return reply({ error: WRONG }, 401);

  const ip = clientIp(req);
  const limited = await guard(LIMITS.login(ip, await digest(email.value)));
  if (limited) return limited;
  if (!(await verifyTurnstile(typeof body.turnstile === "string" ? body.turnstile : undefined, ip))) {
    return reply({ error: "Please complete the human check and try again." }, 400);
  }

  const r = await signInWithPassword(email.value, password);
  if (r.ok) return reply({ session: r.session });
  if (r.reason === "unverified") return reply({ error: "Please confirm your email first. We can send the link again.", code: "unverified" }, 403);
  if (r.reason === "invalid") return reply({ error: WRONG }, 401);
  return reply({ error: "Sign-in is temporarily unavailable. Please try again shortly." }, 503);
}
