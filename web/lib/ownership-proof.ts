import { load } from "cheerio";
import { rootDomain } from "./domain";
import { safeFetch } from "./scan/fetcher";

/* Checks that someone controls a website: either a meta tag on its homepage or a DNS TXT record on the domain.
     <meta name="pagelyt-site-verification" content="TOKEN">
     TXT  example.com  "pagelyt-site-verification=TOKEN" */

export const META_NAME = "pagelyt-site-verification";

async function metaHas(domain: string, token: string): Promise<boolean> {
  for (const host of [domain, `www.${domain}`]) {
    try {
      const r = await safeFetch(new URL(`https://${host}/`));
      // The page that answered must still be on the same site, or a redirect could vouch for someone else's domain.
      if (r.status >= 400 || rootDomain(new URL(r.url).hostname) !== domain) continue;
      const $ = load(r.body);
      const found = $(`meta[name="${META_NAME}"]`).toArray().some((m) => ($(m).attr("content") ?? "").trim() === token);
      if (found) return true;
    } catch {
      /* unreachable host: try the next one */
    }
  }
  return false;
}

async function dnsHas(domain: string, token: string): Promise<boolean> {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`, { headers: { accept: "application/dns-json" } });
    if (!r.ok) return false;
    const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
    // TXT data comes back quoted and may be split into several quoted strings.
    return (j.Answer ?? []).some((a) => a.type === 16 && a.data.replace(/"\s*"/g, "").replace(/"/g, "").trim() === `${META_NAME}=${token}`);
  } catch {
    return false;
  }
}

export async function provesOwnership(domain: string, token: string): Promise<"meta" | "dns" | null> {
  const [meta, dns] = await Promise.all([metaHas(domain, token), dnsHas(domain, token)]);
  return meta ? "meta" : dns ? "dns" : null;
}
