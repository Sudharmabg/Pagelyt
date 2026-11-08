/* Input rules for the sign-up / sign-in modal. Pure functions with no dependencies, so the exact same
   rules run in the browser (fast feedback) and on the server (the check that actually counts).
   Allow-lists, not block-lists: a value either matches a known-good shape or it is rejected. */

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export const LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254, local: 64 },
  phone: { minDigits: 7, maxDigits: 15 },
  password: { min: 8, maxBytes: 72 }, // bcrypt only uses the first 72 bytes
} as const;

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

// Letters and combining marks in any script, then letters, spaces and . ' ’ - only. No digits, no markup, no URLs.
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;

export function checkName(raw: unknown): Checked<string> {
  if (typeof raw !== "string") return fail("Please enter your name.");
  if (/[\u0000-\u001f\u007f-\u009f]/.test(raw)) return fail("Names can only use letters, spaces, apostrophes, full stops and hyphens.");
  const v = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (v.length < LIMITS.name.min || v.length > LIMITS.name.max) return fail("Please enter your name.");
  if (!NAME_RE.test(v)) return fail("Names can only use letters, spaces, apostrophes, full stops and hyphens.");
  return { ok: true, value: v };
}

// Checked piece by piece (split on "@" and ".") rather than with one large pattern, so there is no
// regular expression that could backtrack badly on hostile input. Each pattern below is a single simple class.
const LOCAL_CHARS = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/; // the usual unquoted characters; rejects spaces and line breaks
const DOMAIN_CHARS = /^[a-z0-9-]+$/; // letters, digits and hyphens (a label may not start or end with one, checked below)
const TOP_LEVEL = /^[a-z]{2,24}$/;

export function checkEmail(raw: unknown): Checked<string> {
  const bad = fail("Please enter a valid email address.");
  if (typeof raw !== "string") return bad;
  const v = raw.trim().toLowerCase();
  if (v.length > LIMITS.email.max) return bad;
  const at = v.indexOf("@");
  if (at < 1 || at !== v.lastIndexOf("@") || at > LIMITS.email.local) return bad; // exactly one "@", a local part, not too long
  const local = v.slice(0, at);
  const labels = v.slice(at + 1).split(".");
  if (!LOCAL_CHARS.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return bad;
  if (labels.length < 2 || !labels.every((l) => l.length >= 1 && l.length <= 63 && DOMAIN_CHARS.test(l) && !l.startsWith("-") && !l.endsWith("-"))) return bad;
  if (!TOP_LEVEL.test(labels[labels.length - 1])) return bad;
  return { ok: true, value: v };
}

export function checkPhone(raw: unknown): Checked<string> {
  const bad = fail("Please enter a valid phone number.");
  if (typeof raw !== "string") return bad;
  const v = raw.trim();
  if (v.length > 30 || !/^\+?[\d\s().-]+$/.test(v)) return bad; // "+" only at the very start
  const digits = v.replace(/\D/g, "");
  if (digits.length < LIMITS.phone.minDigits || digits.length > LIMITS.phone.maxDigits) return bad;
  return { ok: true, value: (v.startsWith("+") ? "+" : "") + digits }; // stored in one plain format
}

const COMMON = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "12345678", "123456789", "1234567890",
  "11111111", "00000000", "88888888", "qwertyui", "qwerty123", "qwertyuiop", "1q2w3e4r", "1qaz2wsx", "zaq12wsx",
  "iloveyou", "admin123", "administrator", "welcome1", "welcome123", "letmein1", "letmein123", "abc12345", "abcd1234",
  "monkey123", "dragon123", "football1", "baseball1", "sunshine1", "princess1", "pagelyt", "pagelyt123", "pagelyt1",
]);

export function checkPassword(raw: unknown, email?: string): Checked<string> {
  if (typeof raw !== "string") return fail("Please choose a password.");
  const bytes = new TextEncoder().encode(raw).length;
  if (raw.length < LIMITS.password.min) return fail(`Use at least ${LIMITS.password.min} characters.`);
  if (bytes > LIMITS.password.maxBytes) return fail("That password is too long. Use 72 characters or fewer.");
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fail("That password has characters we can't accept.");
  const lower = raw.toLowerCase();
  const local = email ? email.toLowerCase().split("@")[0] : "";
  if (COMMON.has(lower) || /^(.)\1+$/.test(raw) || (local.length >= 4 && lower === local) || (email && lower === email.toLowerCase())) {
    return fail("That password is too easy to guess. Please choose another.");
  }
  return { ok: true, value: raw };
}

/** Checks a password typed twice. Returns an error message, or null when they match. */
export const passwordsMatch = (a: string, b: string): string | null => (a === b ? null : "The two passwords don't match.");

export type NewLead = { name: string; email: string; phone: string };

/** Validates and normalises the contact details. Phone is optional (the modal no longer asks for it): blank or
   missing becomes "", anything else must still be a valid number. */
export function checkLead(input: { name?: unknown; email?: unknown; phone?: unknown } | undefined | null): { lead: NewLead } | { error: string } {
  const name = checkName(input?.name);
  if (!name.ok) return { error: name.error };
  const email = checkEmail(input?.email);
  if (!email.ok) return { error: email.error };
  const rawPhone = typeof input?.phone === "string" ? input.phone.trim() : input?.phone;
  if (rawPhone == null || rawPhone === "") return { lead: { name: name.value, email: email.value, phone: "" } };
  const phone = checkPhone(rawPhone);
  if (!phone.ok) return { error: phone.error };
  return { lead: { name: name.value, email: email.value, phone: phone.value } };
}
