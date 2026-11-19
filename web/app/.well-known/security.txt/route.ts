import { CONTACT_EMAIL, SITE_URL } from "../../site-config";

// /.well-known/security.txt (RFC 9116). Expires is always about six months ahead, so the file never goes stale between deploys.
export function GET() {
  const expires = new Date(Date.now() + 182 * 24 * 60 * 60 * 1000);
  expires.setUTCHours(0, 0, 0, 0);
  const text = [
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Contact: ${SITE_URL}/contact`,
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    "",
  ].join("\n");
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
