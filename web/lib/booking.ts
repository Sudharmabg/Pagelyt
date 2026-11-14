import { live, rest } from "./scan/store";
import { CONSULTS } from "@/app/content";

/* Consultation booking (tables booking_settings, booking_blocks, bookings: migration 0013; service role only).
   Availability is Pagelyt's own: weekly hours in the founder's timezone, minus blocked days, minus confirmed bookings
   (with a buffer either side), from `notice_hours` ahead up to `horizon_days`. Slots start every 30 minutes.
   Without Supabase env vars everything is kept in memory, so `npm run dev` works with no setup. */

export type Window = [string, string]; // "09:00", "22:00"
export type BookingSettings = {
  timezone: string;
  /** Weekday (0 = Sunday) to opening windows. A day with no windows is closed. */
  hours: Record<string, Window[]>;
  notice_hours: number;
  horizon_days: number;
  buffer_min: number;
};
export type BookingStatus = "confirmed" | "cancelled" | "done";
export type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  minutes: number;
  session: string;
  name: string;
  email: string;
  website: string | null;
  message: string | null;
  timezone: string | null;
  user_id: string | null;
  status: BookingStatus;
  meet_url: string | null;
  manage_token: string;
  created_at: string;
};
export type Block = { day: string; note: string | null };

const ALL_DAY: Window[] = [["09:00", "22:00"]];
export const DEFAULT_SETTINGS: BookingSettings = {
  timezone: "Asia/Kolkata",
  hours: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), ALL_DAY])),
  notice_hours: 24,
  horizon_days: 30,
  buffer_min: 15,
};
export const STEP_MIN = 30;

/** The session a visitor picked, by its exact label (the same labels the request form uses). */
export function sessionOf(label: unknown): { label: string; minutes: number; price: string; title: string } | null {
  const c = CONSULTS.find((x) => `${x.t} · ${x.mins} min · ${x.p}` === label);
  return c ? { label: `${c.t} · ${c.mins} min · ${c.p}`, minutes: c.mins, price: c.p, title: c.t } : null;
}

/* ---------- time zones without a library ---------- */

/** Minutes the zone is ahead of UTC at that instant (330 for India). */
export function tzOffset(at: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(at))
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, Number(x.value)]),
  );
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - at) / 60000);
}

/** The UTC instant of a wall-clock time in a zone ("2026-11-20", "09:30", "Asia/Kolkata"). */
export function zoned(day: string, hm: string, tz: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - tzOffset(guess, tz) * 60000;
  return guess - tzOffset(first, tz) * 60000; // second pass settles daylight-saving edges
}

/** The calendar day of an instant in a zone, as YYYY-MM-DD. */
export function dayIn(at: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const mins = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};
export const validHm = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(s);

/** Every free start time (UTC ISO) for a session of `minutes`, given the settings, blocked days and busy bookings. */
export function freeSlots(s: BookingSettings, minutes: number, blocks: string[], busy: { starts_at: string; ends_at: string }[], now = Date.now()): string[] {
  const blocked = new Set(blocks);
  const pad = s.buffer_min * 60000;
  const taken = busy.map((b) => [Date.parse(b.starts_at) - pad, Date.parse(b.ends_at) + pad] as const);
  const earliest = now + s.notice_hours * 3600000;
  const latest = now + s.horizon_days * 86400000;
  const out: string[] = [];
  const today = dayIn(now, s.timezone);
  for (let i = 0; i <= s.horizon_days; i++) {
    const day = addDays(today, i);
    if (blocked.has(day)) continue;
    const [y, m, d] = day.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    for (const [open, close] of s.hours[String(wd)] ?? []) {
      for (let t = mins(open); t + minutes <= mins(close); t += STEP_MIN) {
        const start = zoned(day, `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`, s.timezone);
        const end = start + minutes * 60000;
        if (start < earliest || start > latest) continue;
        if (taken.some(([a, b]) => start < b && end > a)) continue;
        out.push(new Date(start).toISOString());
      }
    }
  }
  return [...new Set(out)].sort();
}

/** Checks settings sent from the admin panel. */
export function checkSettings(b: Record<string, unknown>): BookingSettings | { error: string } {
  const tz = typeof b.timezone === "string" ? b.timezone : "";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    return { error: "Unknown timezone." };
  }
  if (!tz) return { error: "Unknown timezone." };
  const hours: Record<string, Window[]> = {};
  const raw = (b.hours ?? {}) as Record<string, unknown>;
  for (const d of ["0", "1", "2", "3", "4", "5", "6"]) {
    const list = Array.isArray(raw[d]) ? (raw[d] as unknown[]) : [];
    const ws: Window[] = [];
    for (const w of list.slice(0, 4)) {
      if (!Array.isArray(w) || !validHm(w[0]) || !validHm(w[1]) || mins(w[1]) <= mins(w[0])) return { error: "Each window needs a start before its end (HH:MM)." };
      ws.push([w[0], w[1]]);
    }
    hours[d] = ws;
  }
  const int = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null);
  const notice = int(b.notice_hours, 0, 336), horizon = int(b.horizon_days, 1, 120), buffer = int(b.buffer_min, 0, 120);
  if (notice == null || horizon == null || buffer == null) return { error: "Notice (0–336 hours), horizon (1–120 days) and buffer (0–120 minutes) must be whole numbers." };
  return { timezone: tz, hours, notice_hours: notice, horizon_days: horizon, buffer_min: buffer };
}

/* ---------- storage ---------- */

const g = globalThis as unknown as { __pagelytBooking?: { settings: BookingSettings; blocks: Block[]; bookings: Booking[] } };
const mem = () => (g.__pagelytBooking ??= { settings: DEFAULT_SETTINGS, blocks: [], bookings: [] });
const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function getSettings(): Promise<BookingSettings> {
  if (!live()) return mem().settings;
  const rows = await rest<BookingSettings[]>("booking_settings?id=eq.1&select=timezone,hours,notice_hours,horizon_days,buffer_min");
  return rows[0] ? { ...DEFAULT_SETTINGS, ...rows[0] } : DEFAULT_SETTINGS;
}

export async function saveSettings(s: BookingSettings): Promise<void> {
  if (!live()) return void (mem().settings = s);
  await rest("booking_settings?on_conflict=id", { method: "POST", body: JSON.stringify({ id: 1, ...s, updated_at: new Date().toISOString() }), prefer: "resolution=merge-duplicates,return=minimal" });
}

export async function listBlocks(from: string): Promise<Block[]> {
  if (!live()) return mem().blocks.filter((b) => b.day >= from).sort((a, b) => a.day.localeCompare(b.day));
  return rest<Block[]>(`booking_blocks?select=day,note&day=gte.${from}&order=day.asc`);
}

export async function setBlock(day: string, note: string | null, on: boolean): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Pick a date.");
  if (!live()) {
    const m = mem();
    m.blocks = m.blocks.filter((b) => b.day !== day);
    if (on) m.blocks.push({ day, note });
    return;
  }
  if (on) await rest("booking_blocks?on_conflict=day", { method: "POST", body: JSON.stringify({ day, note }), prefer: "resolution=merge-duplicates,return=minimal" });
  else await rest(`booking_blocks?day=eq.${day}`, { method: "DELETE" });
}

/** Confirmed bookings that end after `fromIso` (for availability). */
export async function busyFrom(fromIso: string): Promise<{ id: string; starts_at: string; ends_at: string }[]> {
  if (!live()) return mem().bookings.filter((b) => b.status === "confirmed" && b.ends_at > fromIso);
  return rest(`bookings?select=id,starts_at,ends_at&status=eq.confirmed&ends_at=gt.${encodeURIComponent(fromIso)}`);
}

export async function listBookings(sinceIso: string): Promise<Booking[]> {
  if (!live()) return mem().bookings.filter((b) => b.ends_at >= sinceIso).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return rest<Booking[]>(`bookings?select=*&ends_at=gte.${encodeURIComponent(sinceIso)}&order=starts_at.asc&limit=300`);
}

export async function getBooking(id: string): Promise<Booking | null> {
  if (!isId(id)) return null;
  if (!live()) return mem().bookings.find((b) => b.id === id) ?? null;
  return (await rest<Booking[]>(`bookings?select=*&id=eq.${id}`))[0] ?? null;
}

export type NewBooking = Omit<Booking, "id" | "status" | "meet_url" | "created_at">;

/** Stores a booking. Null when the start was taken a moment ago (the unique index on confirmed starts). */
export async function insertBooking(row: NewBooking): Promise<Booking | null> {
  if (!live()) {
    const m = mem();
    if (m.bookings.some((b) => b.status === "confirmed" && b.starts_at === row.starts_at)) return null;
    const b: Booking = { ...row, id: crypto.randomUUID(), status: "confirmed", meet_url: null, created_at: new Date().toISOString() };
    m.bookings.push(b);
    return b;
  }
  try {
    return (await rest<Booking[]>("bookings", { method: "POST", body: JSON.stringify(row), prefer: "return=representation" }))[0] ?? null;
  } catch (e) {
    if (/23505|duplicate|409/.test(String(e))) return null;
    throw e;
  }
}

export async function updateBooking(id: string, patch: Partial<Pick<Booking, "starts_at" | "ends_at" | "status" | "meet_url">>): Promise<void> {
  if (!isId(id)) throw new Error("Unknown booking.");
  if (!live()) {
    const b = mem().bookings.find((x) => x.id === id);
    if (b) Object.assign(b, patch);
    return;
  }
  await rest(`bookings?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch), prefer: "return=minimal" });
}

/** Free start times right now, for a session length. */
export async function availability(minutes: number, ignoreId?: string): Promise<{ settings: BookingSettings; slots: string[] }> {
  const settings = await getSettings();
  const now = Date.now();
  const [blocks, busy] = await Promise.all([listBlocks(dayIn(now, settings.timezone)), busyFrom(new Date(now - 86400000).toISOString())]);
  return { settings, slots: freeSlots(settings, minutes, blocks.map((b) => b.day), busy.filter((b) => b.id !== ignoreId), now) };
}

export const newToken = () => [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Constant-time comparison for the manage link's token. */
export function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

/* ---------- calendar file ---------- */

const icsTime = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** Lines longer than 75 octets fold with CRLF + space, as RFC 5545 asks. */
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

export function bookingIcs(b: Pick<Booking, "id" | "starts_at" | "ends_at" | "session" | "meet_url">, opts: { cancel?: boolean; sequence?: number; organizer: string; attendee?: string }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pagelyt//Consultation//EN",
    `METHOD:${opts.cancel ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${b.id}@pagelyt.dev`,
    `SEQUENCE:${opts.sequence ?? 0}`,
    `DTSTAMP:${icsTime(new Date().toISOString())}`,
    `DTSTART:${icsTime(b.starts_at)}`,
    `DTEND:${icsTime(b.ends_at)}`,
    `SUMMARY:${icsText(`Pagelyt: ${b.session.split(" · ")[0]}`)}`,
    `DESCRIPTION:${icsText(`Your Pagelyt consultation with Sudharma.${b.meet_url ? `\nJoin: ${b.meet_url}` : "\nThe video call link follows by email before the session."}`)}`,
    ...(b.meet_url ? [`LOCATION:${icsText(b.meet_url)}`, `URL:${icsText(b.meet_url)}`] : ["LOCATION:Online video call"]),
    `ORGANIZER;CN=Pagelyt:mailto:${opts.organizer}`,
    ...(opts.attendee ? [`ATTENDEE;ROLE=REQ-PARTICIPANT:mailto:${opts.attendee}`] : []),
    `STATUS:${opts.cancel ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
