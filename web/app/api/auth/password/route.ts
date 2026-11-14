import { clientIp, userFromRequest } from "@/lib/auth";
import { notifyPasswordChanged } from "@/lib/email";
import { authConfigured, readJson, reply, setPassword, signInWithPassword, signOutOthers } from "@/lib/gotrue";
import { LIMITS, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";
import { checkPassword } from "@/lib/validate";

/* Change password from the account page: the current password is checked first (so an unattended signed-in
   browser can't be used to take the account over), then the new one is set, other sessions are signed out and
   a notice is emailed. Limited to 5 tries per 15 minutes per account. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const user = await userFromRequest(req);
  if (!user?.email) return reply({ error: "Please sign in again." }, 401);
  const token = req.headers.get("authorization")!.replace(/^Bearer\s+/i, "");
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  const current = body.current;
  if (typeof current !== "string" || !current || new TextEncoder().encode(current).length > 200) return reply({ error: "Please enter your current password.", field: "current" }, 400);
  const next = checkPassword(body.password, user.email);
  if (!next.ok) return reply({ error: next.error, field: "password" }, 400);
  if (next.value === current) return reply({ error: "Your new password must be different from the current one.", field: "password" }, 400);

  const limited = await guard(LIMITS.password(clientIp(req), user.id));
  if (limited) return limited;

  const check = await signInWithPassword(user.email, current);
  if (!check.ok) return check.reason === "unavailable" ? reply({ error: "We couldn't check your password just now. Please try again." }, 503) : reply({ error: "Your current password is incorrect.", field: "current" }, 400);

  const set = await setPassword(token, next.value);
  if (!set.ok) {
    if (set.reason === "weak") return reply({ error: "That password is too easy to guess. Please choose another.", field: "password" }, 400);
    if (set.reason === "same") return reply({ error: "Your new password must be different from the current one.", field: "password" }, 400);
    if (set.reason === "reauth") return reply({ error: "For your security, sign out and use “Forgot password?” to set a new one." }, 409);
    return reply({ error: "We couldn't save your new password just now. Please try again." }, 503);
  }
  await signOutOthers(token);
  await notifyPasswordChanged(user.email, "changed").catch(() => {});
  return reply({ ok: true });
}
