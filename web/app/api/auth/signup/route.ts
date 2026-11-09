import { clientIp, verifyTurnstile } from "@/lib/auth";
import { isDisposable } from "@/lib/disposable";
import { rootDomain } from "@/lib/domain";
import { authConfigured, readJson, reply, signUp } from "@/lib/gotrue";
import { claimDomain, ownerOf } from "@/lib/owners";
import { LIMITS, digest, guard } from "@/lib/ratelimit";
import { ScanError, checkUrl } from "@/lib/scan";
import { live, rest } from "@/lib/scan/store";
import { issueTicket } from "@/lib/ticket";
import { checkLead, checkPassword } from "@/lib/validate";

const EXISTS = "This email already has an account. Please log in instead.";

/* Creates an account from the modal's name, email and password. Order matters: cheap checks first, then limits,
   then the human check (its token is single-use), then Supabase.
   With `url`, the new account also takes that website (held for 24 hours until the email code is entered).
   With `claim: true` (someone who owns a site registered to another account) it takes no website: they prove
   ownership after signing in. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501);
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  if (body.website) return reply({ ok: true, needsVerification: true, session: null, ticket: null }); // honeypot: bots think it worked

  const v = checkLead(body);
  if ("error" in v) return reply({ error: v.error }, 400);
  if (isDisposable(v.lead.email)) return reply({ error: "Please use a permanent email address, not a temporary inbox." }, 400);
  const pw = checkPassword(body.password, v.lead.email);
  if (!pw.ok) return reply({ error: pw.error }, 400);

  let domain: string | null = null;
  if (body.claim !== true && body.url != null) {
    try {
      domain = rootDomain(checkUrl(String(body.url).slice(0, 2048)).hostname);
    } catch (e) {
      return reply({ error: e instanceof ScanError ? e.message : "Invalid address." }, 422);
    }
  }

  const ip = clientIp(req);
  const limited = await guard(LIMITS.signup(ip, await digest(v.lead.email)));
  if (limited) return limited;
  if (!(await verifyTurnstile(typeof body.turnstile === "string" ? body.turnstile : undefined, ip))) {
    return reply({ error: "Please complete the human check and try again." }, 400);
  }

  // One inbox, one account: name+1@gmail.com and n.ame@gmail.com are the same person as name@gmail.com.
  const sameInbox = await rest<boolean>("rpc/inbox_has_account", { method: "POST", body: JSON.stringify({ p_email: v.lead.email }) }).catch(() => false);
  if (sameInbox === true) return reply({ error: EXISTS, code: "exists" }, 409);
  // The site may have been registered since the modal looked it up.
  if (domain && (await ownerOf(domain).catch(() => null))) {
    return reply({ error: `${domain} is already registered to an account. Log in with that account to scan it.`, code: "known" }, 409);
  }

  const r = await signUp(v.lead.email, pw.value, { name: v.lead.name }, `${new URL(req.url).origin}/auth/verified`);
  if (!r.ok) {
    if (r.reason === "weak") return reply({ error: "That password is too easy to guess. Please choose another." }, 400);
    if (r.reason === "invalid_email") return reply({ error: "That email address can't receive mail. Please use your real email address." }, 400);
    if (r.reason === "email_limit") return reply({ error: "We're sending too many sign-up emails right now. Please try again in a few minutes." }, 429);
    return reply({ error: "Sign-up is temporarily unavailable. Please try again shortly." }, 503);
  }
  if (!r.created || !r.userId) return reply({ error: EXISTS, code: "exists" }, 409);

  if (domain && !(await claimDomain(domain, r.userId, !!r.session).catch(() => true))) {
    return reply({ error: `${domain} was just registered to another account.`, code: "known" }, 409);
  }
  // The ticket lets the report scan start without a second human check, as this new account.
  const ticket = await issueTicket(v.lead.email, r.userId);
  return reply({ ok: true, needsVerification: !r.session, session: r.session, ticket });
}
