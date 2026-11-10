import { registrable } from "../scan/extras";

/* Domain age and registration details from RDAP, the registries' public replacement for WHOIS.
   rdap.org redirects each query to the right registry. */

export type DomainAge = {
  domain: string;
  ok: boolean;
  created: string | null;
  expires: string | null;
  updated: string | null;
  registrar: string | null;
  status: string[];
  nameservers: string[];
  error?: string;
};

type Rdap = {
  events?: { eventAction: string; eventDate: string }[];
  entities?: { roles?: string[]; vcardArray?: [string, [string, unknown, string, unknown][]] }[];
  status?: string[];
  nameservers?: { ldhName?: string }[];
};

/** "https://www.Example.co.uk/x" → "example.co.uk". null when it isn't a domain name. */
export function cleanDomain(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/[/?#:].*$/, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) || s.length > 253) return null;
  return registrable(s);
}

export async function domainAge(domain: string): Promise<DomainAge> {
  const empty: DomainAge = { domain, ok: false, created: null, expires: null, updated: null, registrar: null, status: [], nameservers: [] };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { signal: ctl.signal, headers: { accept: "application/rdap+json, application/json", "user-agent": "PagelytBot/0.1 (+https://pagelyt.com/bot)" } });
    if (r.status === 404) return { ...empty, error: "Not registered, or the registry doesn't publish its records." };
    if (!r.ok) return { ...empty, error: `The registry didn't answer (${r.status}). Try again later.` };
    const j = (await r.json()) as Rdap;
    const ev = (a: string) => j.events?.find((e) => e.eventAction === a)?.eventDate ?? null;
    const reg = j.entities?.find((e) => e.roles?.includes("registrar"));
    const fn = reg?.vcardArray?.[1]?.find((f) => f[0] === "fn")?.[3];
    return {
      domain,
      ok: true,
      created: ev("registration"),
      expires: ev("expiration"),
      updated: ev("last changed"),
      registrar: typeof fn === "string" ? fn : null,
      status: (j.status ?? []).slice(0, 8),
      nameservers: (j.nameservers ?? []).map((n) => (n.ldhName ?? "").toLowerCase()).filter(Boolean).slice(0, 8),
    };
  } catch {
    return { ...empty, error: ctl.signal.aborted ? "The registry took too long to answer." : "Couldn't reach the registry." };
  } finally {
    clearTimeout(t);
  }
}
