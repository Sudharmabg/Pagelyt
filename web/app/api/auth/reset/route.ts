import { clientIp } from "@/lib/auth";
import { notifyPasswordChanged } from "@/lib/email";
import { authConfigured, readJson, reply, setPassword, signOutOthers, verifyRecoveryCode } from "@/lib/gotrue";
import { LIMITS, digest, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";
import { checkCode, checkEmail, checkPassword } from "@/lib/validate";

const WRONG = "That code is wrong or has expired. Check the latest email, or send a new code.";

/* "Forgot password", step 2: the 6-digit code from the reset email plus the new password. The code opens a short
   recovery session, the password is set with it, other sessions are signed out and this browser is signed in.
   Guesses are limited per address and per IP (6 tries per 15 minutes per address). */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  const email = checkEmail(body.email);
  if (!email.ok) return reply({ error: email.error }, 400);
  const code = checkCode(body.code);
  if (!code.ok) return reply({ error: code.error }, 400);
  const password = checkPassword(body.password, email.value);
  if (!password.ok) return reply({ error: password.error, field: "password" }, 400);

  const limited = await guard(LIMITS.reset(clientIp(req), await digest(email.value)));
  if (limited) return limited;

  const v = await verifyRecoveryCode(email.value, code.value);
  if (!v.ok) return v.reason === "wrong" ? reply({ error: WRONG }, 400) : reply({ error: "We couldn't check the code just now. Please try again shortly." }, 503);

  const set = await setPassword(v.session.access_token, password.value);
  if (!set.ok) {
    if (set.reason === "weak") return reply({ error: "That password is too easy to guess. Please choose another.", field: "password" }, 400);
    if (set.reason === "same") return reply({ error: "That's your current password. Please choose a new one.", field: "password" }, 400);
    return reply({ error: "We couldn't save your new password just now. Please try again." }, 503);
  }
  await signOutOthers(v.session.access_token);
  await notifyPasswordChanged(email.value, "reset").catch(() => {});
  return reply({ session: v.session });
}
