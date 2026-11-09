import { live, rest } from "./scan/store";
import { SESSIONS } from "@/app/content";

/* Consultation requests and contact messages (table `requests`, migration 0008; service role only).
   Without Supabase env vars they are kept in memory, so `npm run dev` works with no setup. */

export type RequestKind = "consultation" | "contact";
export const REQUEST_STATUSES = ["new", "contacted", "scheduled", "closed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestRow = {
  id: string;
  kind: RequestKind;
  name: string;
  email: string;
  website: string | null;
  session: string | null;
  preferred_time: string | null;
  message: string | null;
  status: RequestStatus;
  user_id: string | null;
  created_at: string;
};

export type NewRequest = Omit<RequestRow, "id" | "status" | "created_at">;

const g = globalThis as unknown as { __pagelytRequests?: RequestRow[] };
const mem = () => (g.__pagelytRequests ??= []);

const clip = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim().replace(/\s+\n/g, "\n") : "";
  return s ? s.slice(0, max) : null;
};

/** Checks and normalises a submitted form. Returns the row to store, or a message for the visitor. */
export function checkRequest(body: Record<string, unknown>, userId: string | null): { row: NewRequest } | { error: string } {
  const kind: RequestKind = body.kind === "consultation" ? "consultation" : "contact";
  const name = clip(body.name, 100);
  const email = clip(body.email, 254)?.toLowerCase() ?? null;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter your name and a valid email address." };
  const session = kind === "consultation" ? clip(body.session, 120) : null;
  if (kind === "consultation" && (!session || !SESSIONS.includes(session))) return { error: "Please choose a session." };
  const message = clip(body.message, 3000);
  if (kind === "contact" && !message) return { error: "Please write a short message." };
  return {
    row: {
      kind,
      name,
      email,
      website: clip(body.website, 300),
      session,
      preferred_time: kind === "consultation" ? clip(body.preferredTime, 120) : null,
      message,
      user_id: userId,
    },
  };
}

export async function saveRequest(row: NewRequest): Promise<void> {
  if (live()) {
    await rest("requests", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
    return;
  }
  mem().unshift({ ...row, id: crypto.randomUUID(), status: "new", created_at: new Date().toISOString() });
}

export async function listRequests(limit = 200): Promise<RequestRow[]> {
  if (!live()) return mem().slice(0, limit);
  return rest<RequestRow[]>(`requests?select=*&order=created_at.desc&limit=${limit}`);
}

export async function setRequestStatus(id: string, status: RequestStatus): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unknown request.");
  if (!live()) {
    const r = mem().find((x) => x.id === id);
    if (r) r.status = status;
    return;
  }
  await rest(`requests?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status }), prefer: "return=minimal" });
}
