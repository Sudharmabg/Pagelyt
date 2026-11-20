import { clientIp, userFromRequest } from "@/lib/auth";
import { notifyPasswordChanged } from "@/lib/email";
import { authConfigured, readJson, reply, setPassword, signInWithPassword, signOutOthers, updateUserMeta, userWithIdentities } from "@/lib/gotrue";
import { LIMITS, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";
import { checkPassword } from "@/lib/validate";

/* Change password from the account page: the current password is checked first (so an unattended signed-in
   browser can't be used to take the account over), then the new one is set, other sessions are signed out and
   a notice is emailed. Limited to 5 tries per 15 minutes per account.
   With `set: true` an account that signed up with Google or GitHub adds its first password (there is no current one
   to check). Only allowed while it has never had one: no email identity and no `password_set` mark in app_metadata,
   which only the server can write. After that the normal change (current password first) applies. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const user = await userFromRequest(req);
  if (!user?.email) return reply({ error: "Please sign in again." }, 401);
  const token = req.headers.get("authorization")!.replace(/^Bearer\s+/i, "");
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  if (body.set === true) return setFirst(req, token, user.id, user.email, body.password);
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

async function setFirst(req: Request, token: string, userId: string, email: string, password: unknown) {
  const next = checkPassword(password, email);
  if (!next.ok) return reply({ error: next.error, field: "password" }, 400);
  const limited = await guard(LIMITS.password(clientIp(req), userId));
  if (limited) return limited;
  const u = await userWithIdentities(token);
  if (!u) return reply({ error: "We couldn't check your account just now. Please try again." }, 503);
  if (u.providers.includes("email") || u.app.password_set === true) return reply({ error: "This account already has a password. Use Change password instead.", code: "has_password" }, 409);
  const set = await setPassword(token, next.value);
  if (!set.ok) {
    if (set.reason === "weak") return reply({ error: "That password is too easy to guess. Please choose another.", field: "password" }, 400);
    if (set.reason === "reauth") return reply({ error: "For your security, sign out, sign in again and then add the password." }, 409);
    return reply({ error: "We couldn't save your password just now. Please try again." }, 503);
  }
  await updateUserMeta(userId, { app_metadata: { password_set: true } });
  await signOutOthers(token);
  await notifyPasswordChanged(email, "set").catch(() => {});
  return reply({ ok: true });
}
