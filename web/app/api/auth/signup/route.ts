import { clientIp, verifyTurnstile } from "@/lib/auth";
import { authConfigured, readJson, reply, signUp } from "@/lib/gotrue";
import { LIMITS, digest, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";
import { issueTicket } from "@/lib/ticket";
import { checkLead, checkPassword } from "@/lib/validate";

/* Creates an account from the modal's details. Order matters: cheap checks first, then limits, then the human
   check (its token is single-use), then Supabase. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  if (body.website) return reply({ ok: true, needsVerification: true, session: null, ticket: null }); // honeypot: bots think it worked

  const v = checkLead(body);
  if ("error" in v) return reply({ error: v.error }, 400);
  const pw = checkPassword(body.password, v.lead.email);
  if (!pw.ok) return reply({ error: pw.error }, 400);
  // The modal shows the password with a show/hide toggle instead of asking twice; older clients may still send "confirm".
  if (body.confirm != null && String(body.confirm) !== String(body.password)) return reply({ error: "The two passwords don't match." }, 400);

  const ip = clientIp(req);
  const limited = await guard(LIMITS.signup(ip, await digest(v.lead.email)));
  if (limited) return limited;
  if (!(await verifyTurnstile(typeof body.turnstile === "string" ? body.turnstile : undefined, ip))) {
    return reply({ error: "Please complete the human check and try again." }, 400);
  }

  const r = await signUp(v.lead.email, pw.value, { name: v.lead.name, phone: v.lead.phone }, `${new URL(req.url).origin}/auth/verified`);
  if (!r.ok) {
    return r.reason === "weak"
      ? reply({ error: "That password is too easy to guess. Please choose another." }, 400)
      : reply({ error: "Sign-up is temporarily unavailable. Please try again shortly." }, 503);
  }
  // The ticket lets the report scan start without a second human check. Only issued for a genuinely new account.
  const ticket = r.created ? await issueTicket(v.lead.email) : null;
  return reply({ ok: true, needsVerification: !r.session, session: r.session, ticket });
}
