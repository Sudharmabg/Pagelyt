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
  resend: (ip: string, email: string): Rule[] => [
    { key: `resend:em:min:${email}`, limit: 1, windowSec: 60 },
    { key: `resend:em:hr:${email}`, limit: 5, windowSec: 3600 },
    { key: `resend:ip:${ip}`, limit: 15, windowSec: 3600 },
  ],
};
