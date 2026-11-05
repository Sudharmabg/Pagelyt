import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";

/* SSRF-safe fetcher. Every connection's resolved IP is validated at connect time
   (so DNS rebinding cannot swap in a private address), redirects are followed manually. */

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

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
    return /^(fc|fd|fe[89ab])/.test(l);
  }
  return true;
}

const safeLookup: typeof dns.lookup = ((host: string, opts: unknown, cb: unknown) => {
  const callback = (typeof opts === "function" ? opts : cb) as (...a: unknown[]) => void;
  dns.lookup(host, { all: true }, (err, addrs) => {
    if (err) return callback(err);
    const ok = addrs.filter((a) => !isPrivateIp(a.address));
    if (!ok.length) return callback(new Error("Blocked: address is not publicly routable"));
    const wantAll = typeof opts === "object" && opts !== null && (opts as { all?: boolean }).all;
    if (wantAll) return callback(null, ok);
    callback(null, ok[0].address, ok[0].family);
  });
}) as typeof dns.lookup;

export function normaliseUrl(raw: string): URL | null {
  try {
    const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".") && !net.isIP(u.hostname)) return null;
    if (u.username || u.password) return null;
    if (net.isIP(u.hostname) && isPrivateIp(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

function once(url: URL, headers: Record<string, string>): Promise<Omit<FetchResult, "chain">> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      { method: "GET", headers, lookup: safeLookup, timeout: TIMEOUT_MS },
      (res) => {
        const sock = res.socket as import("node:tls").TLSSocket;
        let cert: FetchResult["cert"];
        if (url.protocol === "https:" && typeof sock.getPeerCertificate === "function") {
          const c = sock.getPeerCertificate();
          if (c && c.valid_to) {
            cert = {
              validTo: new Date(c.valid_to),
              issuer: String((c.issuer && (c.issuer.O || c.issuer.CN)) || "unknown"),
              protocol: sock.getProtocol?.() ?? null,
            };
          }
        }
        const enc = String(res.headers["content-encoding"] || "").toLowerCase();
        const stream =
          enc === "gzip" ? res.pipe(zlib.createGunzip())
          : enc === "br" ? res.pipe(zlib.createBrotliDecompress())
          : enc === "deflate" ? res.pipe(zlib.createInflate())
          : res;
        const chunks: Buffer[] = [];
        let bytes = 0;
        stream.on("data", (c: Buffer) => {
          bytes += c.length;
          if (bytes <= MAX_BYTES) chunks.push(c);
          else req.destroy();
        });
        const done = () =>
          resolve({
            url: url.toString(),
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
            bytes,
            ms: Date.now() - started,
            cert,
          });
        stream.on("end", done);
        stream.on("close", done);
        stream.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetch(start: URL, opts: { ua?: string } = {}): Promise<FetchResult> {
  const headers = {
    "user-agent": opts.ua || "PagelytBot/0.1 (+https://pagelyt.com/bot)",
    accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
    "accept-encoding": "gzip, br",
  };
  const chain: FetchResult["chain"] = [];
  let url = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const r = await once(url, headers);
    chain.push({ url: r.url, status: r.status });
    const loc = r.headers.location;
    if (r.status >= 300 && r.status < 400 && typeof loc === "string") {
      const next = new URL(loc, url);
      if (!/^https?:$/.test(next.protocol) || (net.isIP(next.hostname) && isPrivateIp(next.hostname))) {
        throw new Error("Blocked redirect target");
      }
      url = next;
      continue;
    }
    return { ...r, chain };
  }
  throw new Error("Too many redirects");
}
