import { clientIp, userFromRequest } from "@/lib/auth";
import { rootDomain } from "@/lib/domain";
import { readJson, reply } from "@/lib/gotrue";
import { claimDomain, claimToken, dropClaims, ownerOf, setOwner } from "@/lib/owners";
import { provesOwnership } from "@/lib/ownership-proof";
import { LIMITS, guard } from "@/lib/ratelimit";
import { live } from "@/lib/scan/store";

/* Proof of ownership, for someone whose website is registered to another account.
   { domain, action: "start" } returns the token to publish; { domain, action: "check" } looks for it on the
   homepage (meta tag) or in DNS (TXT) and, when found, moves the website to the caller's account.
   Needs a verified signed-in user (Authorization: Bearer <token>). */
export async function POST(req: Request) {
  if (!live()) return reply({ error: "Accounts need Supabase to be configured." }, 501);
  const user = await userFromRequest(req);
  if (!user) return reply({ error: "Please log in first." }, 401);
  if (!user.verified) return reply({ error: "Please confirm your email first." }, 403);
  const body = await readJson(req);
  const raw = typeof body?.domain === "string" ? body.domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] : "";
  if (!raw || raw.length > 253 || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) return reply({ error: "Enter a website address such as example.com." }, 400);
  const domain = rootDomain(raw);

  try {
    const owner = await ownerOf(domain);
    if (owner?.user_id === user.id) return reply({ status: "owned", domain });
    if (!owner) {
      // Nobody holds it any more (for example an unconfirmed sign-up expired): it is simply theirs.
      if (await claimDomain(domain, user.id, true)) return reply({ status: "owned", domain });
    }
    const token = await claimToken(domain, user.id);
    if (body?.action !== "check") return reply({ status: "pending", domain, token });

    const limited = await guard(LIMITS.claim(clientIp(req)));
    if (limited) return limited;
    const how = await provesOwnership(domain, token);
    if (!how) return reply({ status: "pending", domain, token, error: "We couldn't find the code yet. DNS changes can take a few minutes to show up." });
    await setOwner(domain, user.id, true);
    await dropClaims(domain);
    return reply({ status: "owned", domain, how });
  } catch {
    return reply({ error: "Couldn't check ownership just now. Please try again shortly." }, 503);
  }
}
