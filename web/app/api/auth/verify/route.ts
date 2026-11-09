import { clientIp, userFromRequest } from "@/lib/auth";
import { authConfigured, readJson, reply, verifyEmailCode } from "@/lib/gotrue";
import { confirmOwner } from "@/lib/owners";
import { LIMITS, digest, guard } from "@/lib/ratelimit";
import { claimScansByEmail, live } from "@/lib/scan/store";
import { checkCode, checkEmail } from "@/lib/validate";

const WRONG = "That code is wrong or has expired. Check the latest email, or send a new code.";

/* Confirms a new account with the 6-digit code from its email and signs it in. This happens once per account.
   Guesses are limited per address and per IP (6 tries per 15 minutes per address). */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  const email = checkEmail(body.email);
  if (!email.ok) return reply({ error: email.error }, 400);
  const code = checkCode(body.code);
  if (!code.ok) return reply({ error: code.error }, 400);

  const limited = await guard(LIMITS.verify(clientIp(req), await digest(email.value)));
  if (limited) return limited;

  const r = await verifyEmailCode(email.value, code.value);
  if (!r.ok) return r.reason === "wrong" ? reply({ error: WRONG }, 400) : reply({ error: "We couldn't check the code just now. Please try again shortly." }, 503);

  // The account is confirmed: its websites are now held for good, and scans started with this email are its own.
  const user = await userFromRequest(new Request(req.url, { headers: { authorization: `Bearer ${r.session.access_token}` } }));
  if (user) {
    await confirmOwner(user.id).catch(() => {});
    await claimScansByEmail(user.id, email.value).catch(() => {});
  }
  return reply({ session: r.session });
}
