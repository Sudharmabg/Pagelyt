import { clientIp } from "@/lib/auth";
import { rootDomain } from "@/lib/domain";
import { authConfigured, readJson, reply } from "@/lib/gotrue";
import { ownerOf } from "@/lib/owners";
import { LIMITS, guard } from "@/lib/ratelimit";
import { ScanError, checkUrl } from "@/lib/scan";
import { live } from "@/lib/scan/store";

/* "Is this website already registered?" The scan modal asks this as soon as a URL is entered: a known site gets
   the log-in form (only its owner can scan it), a new site gets the sign-up form. Rate-limited per IP. */
export async function POST(req: Request) {
  if (!live() || !authConfigured()) return reply({ error: "unavailable" }, 501); // the modal falls back to the plain form
  const body = await readJson(req);
  if (!body) return reply({ error: "Invalid request." }, 400);
  let host: string;
  try {
    host = checkUrl(String(body.url ?? "").slice(0, 2048)).hostname;
  } catch (e) {
    return reply({ error: e instanceof ScanError ? e.message : "Invalid address." }, 422);
  }
  const limited = await guard(LIMITS.site(clientIp(req)));
  if (limited) return limited;
  const domain = rootDomain(host);
  try {
    return reply({ known: !!(await ownerOf(domain)), domain });
  } catch {
    return reply({ error: "Sign-in is temporarily unavailable. Please try again shortly." }, 503);
  }
}
