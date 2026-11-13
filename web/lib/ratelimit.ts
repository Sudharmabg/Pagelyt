import { rateLimit } from "./scan/store";

/* Shared rate-limit helpers for the sign-up and sign-in endpoints. */

export type Rule = { key: string; limit: number; windowSec: number };

/** A short SHA-256 fingerprint, so an email address never sits in the rate-limit table in plain text. */
export async function digest(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim().toLowerCase()));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Checks every rule in order. Returns a ready-made 429 response for the first one exceeded, or null if all pass.
    By default the endpoint blocks when the limiter itself is unavailable. */
export async function guard(rules: Rule[], opts: { failClosed?: boolean } = { failClosed: true }): Promise<Response | null> {
  for (const r of rules) {
    if (!(await rateLimit(r.key, r.limit, r.windowSec, opts))) {
      return Response.json(
        { error: "Too many attempts. Please wait a little and try again." },
        { status: 429, headers: { "retry-after": String(r.windowSec), "cache-control": "no-store" } }
      );
    }
  }
  return null;
}

/** Per-action limits, in one place so they are easy to review. */
export const LIMITS = {
  check: (ip: string, email: string): Rule[] => [
    { key: `check:ip:${ip}`, limit: 10, windowSec: 900 },
    { key: `check:em:${email}`, limit: 5, windowSec: 900 },
  ],
  signup: (ip: string, email: string): Rule[] => [
    { key: `signup:ip:${ip}`, limit: 3, windowSec: 3600 },
    { key: `signup:em:${email}`, limit: 3, windowSec: 3600 },
  ],
  login: (ip: string, email: string): Rule[] => [
    { key: `login:em:${email}`, limit: 5, windowSec: 900 },
    { key: `login:ip:${ip}`, limit: 20, windowSec: 900 },
  ],
  forgot: (ip: string, email: string): Rule[] => [
    { key: `forgot:em:min:${email}`, limit: 1, windowSec: 60 },
    { key: `forgot:em:hr:${email}`, limit: 5, windowSec: 3600 },
    { key: `forgot:ip:${ip}`, limit: 15, windowSec: 3600 },
  ],
  site: (ip: string): Rule[] => [{ key: `site:ip:${ip}`, limit: 30, windowSec: 900 }],
  verify: (ip: string, email: string): Rule[] => [
    { key: `verify:em:${email}`, limit: 6, windowSec: 900 },
    { key: `verify:ip:${ip}`, limit: 30, windowSec: 900 },
  ],
  claim: (ip: string): Rule[] => [{ key: `claim:ip:${ip}`, limit: 20, windowSec: 3600 }],
  /** Free tools that fetch other sites from our server (AI bot checker, hreflang, domain age…). */
  tool: (ip: string, user: string): Rule[] => [
    { key: `tool:u:${user}`, limit: 40, windowSec: 900 },
    { key: `tool:ip:${ip}`, limit: 60, windowSec: 900 },
  ],
  /** Batched tools (bulk schema, sitemap crawl): one request per batch, so a 1,000-page sitemap is 50 requests. */
  toolBatch: (ip: string, user: string): Rule[] => [
    { key: `toolb:u:${user}`, limit: 150, windowSec: 900 },
    { key: `toolb:ip:${ip}`, limit: 200, windowSec: 900 },
  ],
  /** Raw vs rendered HTML: each one spends paid Browser Rendering time. */
  render: (ip: string, user: string): Rule[] => [
    { key: `render:u:${user}`, limit: 20, windowSec: 3600 },
    { key: `render:ip:${ip}`, limit: 30, windowSec: 3600 },
  ],
  /** Sitemap pages loaded in a real browser: five pages a batch. */
  renderBatch: (ip: string, user: string): Rule[] => [
    { key: `rendb:u:${user}`, limit: 60, windowSec: 3600 },
    { key: `rendb:ip:${ip}`, limit: 80, windowSec: 3600 },
  ],
  resend: (ip: string, email: string): Rule[] => [
    { key: `resend:em:min:${email}`, limit: 1, windowSec: 60 },
    { key: `resend:em:hr:${email}`, limit: 5, windowSec: 3600 },
    { key: `resend:ip:${ip}`, limit: 15, windowSec: 3600 },
  ],
};
