/* Edge-safe fetcher: uses only the Fetch API, so it runs on Cloudflare Workers and Node alike.

   SSRF: Workers cannot reach private networks, so the remaining risk is a user pointing us at
   an internal-looking name or IP literal. Those are refused up front and on every redirect.
   (If this ever runs on a plain Node server, add resolved-IP checks back; see DEPLOY.md.)

   Not available at the edge: reading the TLS certificate. SSL expiry and TLS version checks are
   therefore skipped; `cert` is left undefined and the checks that use it simply do not fire. */

export type FetchResult = {
  url: string;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  bytes: number;
  ms: number;
  chain: { url: string; status: number }[];
  cert?: { validTo: Date; issuer: string; protocol: string | null };
};

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;

const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isIpLiteral(host: string): boolean {
  return V4.test(host) || host.includes(":");
}

export function isPrivateIp(ip: string): boolean {
  const m = ip.match(V4);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (l === "::1" || l === "::") return true;
  if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
  return /^(fc|fd|fe[89ab])/.test(l) || l.includes(":");
}

function blockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan") || h.endsWith(".home.arpa")) return true;
  return isIpLiteral(h) && isPrivateIp(h);
}

export function normaliseUrl(raw: string): URL | null {
  try {
    const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".") && !isIpLiteral(u.hostname)) return null;
    if (u.username || u.password) return null;
    if (blockedHost(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

async function readCapped(res: Response): Promise<{ text: string; bytes: number }> {
  if (!res.body) return { text: "", bytes: 0 };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes <= MAX_BYTES) chunks.push(value);
    else {
      await reader.cancel();
      break;
    }
  }
  const all = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.byteLength;
  }
  return { text: new TextDecoder().decode(all), bytes };
}

function headerRecord(h: Headers): FetchResult["headers"] {
  // No prototype, so a header literally named "__proto__" is just another key.
  const out = Object.create(null) as FetchResult["headers"];
  h.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

type Opts = { ua?: string; follow?: boolean; method?: "GET" | "HEAD"; accept?: string };

async function once(url: URL, ua: string, o: Opts): Promise<Omit<FetchResult, "chain">> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url.href, {
      method: o.method ?? "GET",
      redirect: "manual",
      signal: ctl.signal,
      headers: { "user-agent": ua, accept: o.accept ?? "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" },
    });
    const { text, bytes } = o.method === "HEAD" ? { text: "", bytes: 0 } : await readCapped(res);
    return { url: url.href, status: res.status, headers: headerRecord(res.headers), body: text, bytes, ms: Date.now() - t0 };
  } catch (e) {
    if (ctl.signal.aborted) throw new Error("Request timed out");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** `follow: false` returns the first response, redirects included, and spends only one subrequest. */
export async function safeFetch(start: URL, opts: Opts = {}): Promise<FetchResult> {
  const ua = opts.ua || "PagelytBot/0.1 (+https://pagelyt.com/bot)";
  if (blockedHost(start.hostname)) throw new Error("Blocked: address is not publicly routable");
  const chain: FetchResult["chain"] = [];
  let url = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const r = await once(url, ua, opts);
    chain.push({ url: r.url, status: r.status });
    const loc = r.headers.location;
    if (opts.follow !== false && r.status >= 300 && r.status < 400 && typeof loc === "string") {
      const next = new URL(loc, url);
      if (!/^https?:$/.test(next.protocol) || blockedHost(next.hostname)) throw new Error("Blocked redirect target");
      url = next;
      continue;
    }
    return { ...r, chain };
  }
  throw new Error("Too many redirects");
}
