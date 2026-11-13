/* Server only. Encrypts Google refresh tokens before they are stored, and signs the OAuth `state` so the callback
   knows which Pagelyt account and site started the connection. Everything is keyed from the GOOGLE_TOKEN_KEY
   secret (any long random string); Web Crypto only, so it runs on Cloudflare Workers. */

const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64u = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

function secret(): string {
  const s = process.env.GOOGLE_TOKEN_KEY;
  if (!s || s.length < 16) throw new Error("GOOGLE_TOKEN_KEY is not set (any random string of 32+ characters)");
  return s;
}

async function digest(label: string) {
  return crypto.subtle.digest("SHA-256", enc.encode(`${label}:${secret()}`));
}
const aesKey = async () => crypto.subtle.importKey("raw", await digest("pagelyt-google-aes"), "AES-GCM", false, ["encrypt", "decrypt"]);
const hmacKey = async () => crypto.subtle.importKey("raw", await digest("pagelyt-google-hmac"), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** "v1.<iv>.<ciphertext>", base64url. */
export async function sealToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), enc.encode(plain));
  return `v1.${b64u(iv)}.${b64u(ct)}`;
}

export async function openToken(sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("Unknown token format");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(iv) }, await aesKey(), unb64u(ct));
  return dec.decode(pt);
}

async function sign(data: string) {
  return b64u(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(data)));
}

export type OAuthState = { u: string; s: string; r: string; p: "gsc" | "ga4"; n: string; x: number };

/** A short-lived (15 minutes) pass that lets the print page show this scan's Google Analytics section. The print page
    is private by link only, so Google data appears there only when the owner's PDF request signed for it. */
export async function signPrint(scanId: string): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify({ k: "print", s: scanId, x: Date.now() + 15 * 60_000 })));
  return `${body}.${await sign(body)}`;
}

export async function readPrint(token: string, scanId: string): Promise<boolean> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), unb64u(sig), enc.encode(body)).catch(() => false);
  if (!ok) return false;
  try {
    const p = JSON.parse(dec.decode(unb64u(body))) as { k?: string; s?: string; x?: number };
    return p.k === "print" && p.s === scanId && typeof p.x === "number" && p.x > Date.now();
  } catch {
    return false;
  }
}

/** Signed, short-lived (15 minutes) state for the consent round trip. */
export async function makeState(o: Omit<OAuthState, "n" | "x">): Promise<{ state: string; verifier: string }> {
  const st: OAuthState = { ...o, n: b64u(crypto.getRandomValues(new Uint8Array(16))), x: Date.now() + 15 * 60_000 };
  const body = b64u(enc.encode(JSON.stringify(st)));
  return { state: `${body}.${await sign(body)}`, verifier: await pkceVerifier(st.n) };
}

export async function readState(state: string): Promise<(OAuthState & { verifier: string }) | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), unb64u(sig), enc.encode(body)).catch(() => false);
  if (!ok) return null;
  try {
    const st = JSON.parse(dec.decode(unb64u(body))) as OAuthState;
    if (typeof st.x !== "number" || st.x < Date.now() || (st.p !== "gsc" && st.p !== "ga4") || typeof st.u !== "string") return null;
    return { ...st, verifier: await pkceVerifier(st.n) };
  } catch {
    return null;
  }
}

/* PKCE: the verifier is derived from the state's nonce, so nothing has to be stored between the two requests. */
async function pkceVerifier(nonce: string) {
  return (await sign(`pkce:${nonce}`)).slice(0, 43);
}
export async function pkceChallenge(verifier: string) {
  return b64u(await crypto.subtle.digest("SHA-256", enc.encode(verifier)));
}
