import { getDomain } from "tldts";

/* The unit a website is owned and priced by: its registrable root domain. www.example.com, blog.example.com and
   example.com/page are all "example.com"; example.co.uk is handled by the public-suffix list. Private suffixes
   are honoured too, so alice.github.io and bob.github.io stay two different sites. */
export function rootDomain(host: string): string {
  const h = host.trim().toLowerCase().replace(/\.$/, "");
  return getDomain(h, { allowPrivateDomains: true }) ?? h;
}
