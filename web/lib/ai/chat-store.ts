import { live, rest } from "@/lib/scan/store";

/* Saved Ask Pagelyt conversations (migration 0015). Threads belong to one user and one website (host), so they
   survive rescans. Every function takes the user id and only touches that user's rows. Server only.
   Without Supabase env vars an in-memory store keeps `npm run dev` working (lost on restart). */

export type ChatSource = { title: string; url: string };
export type ThreadRow = { id: string; user_id: string; host: string; scan_id: string | null; title: string; created_at: string; updated_at: string };
export type MessageRow = { id: string; thread_id: string; user_id: string; role: "user" | "assistant"; content: string; sources: ChatSource[]; finding: string | null; feedback: -1 | 1 | null; created_at: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validUuid = (id: unknown): id is string => typeof id === "string" && UUID.test(id);
const q = encodeURIComponent;

type Mem = { threads: ThreadRow[]; messages: MessageRow[] };
const g = globalThis as unknown as { __pagelytChat?: Mem };
const mem = (): Mem => (g.__pagelytChat ??= { threads: [], messages: [] });

/** A short thread title from the first question. */
export const titleFrom = (question: string) => {
  const t = question.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t || "New chat";
};

export async function listThreads(userId: string, host: string, limit = 40): Promise<ThreadRow[]> {
  if (!live()) return mem().threads.filter((t) => t.user_id === userId && t.host === host).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit);
  return rest<ThreadRow[]>(`chat_threads?user_id=eq.${q(userId)}&host=eq.${q(host)}&select=*&order=updated_at.desc&limit=${limit}`);
}

export async function getThread(userId: string, id: string): Promise<ThreadRow | null> {
  if (!validUuid(id)) return null;
  if (!live()) return mem().threads.find((t) => t.id === id && t.user_id === userId) ?? null;
  const rows = await rest<ThreadRow[]>(`chat_threads?id=eq.${q(id)}&user_id=eq.${q(userId)}&select=*&limit=1`);
  return rows[0] ?? null;
}

export async function createThread(userId: string, host: string, scanId: string, title: string): Promise<ThreadRow> {
  const now = new Date().toISOString();
  const row: ThreadRow = { id: crypto.randomUUID(), user_id: userId, host, scan_id: scanId, title: title.slice(0, 120), created_at: now, updated_at: now };
  if (live()) await rest("chat_threads", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
  else mem().threads.push(row);
  return row;
}

/** Moves the thread to the top of History and records the report it was last used with. */
export async function touchThread(id: string, scanId: string): Promise<void> {
  const patch = { updated_at: new Date().toISOString(), scan_id: scanId };
  if (!live()) {
    const t = mem().threads.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
    return;
  }
  await rest(`chat_threads?id=eq.${q(id)}`, { method: "PATCH", body: JSON.stringify(patch), prefer: "return=minimal" });
}

export async function deleteThread(userId: string, id: string): Promise<void> {
  if (!validUuid(id)) return;
  if (!live()) {
    const m = mem();
    m.threads = m.threads.filter((t) => !(t.id === id && t.user_id === userId));
    m.messages = m.messages.filter((x) => !(x.thread_id === id && x.user_id === userId));
    return;
  }
  // chat_messages go with it (on delete cascade).
  await rest(`chat_threads?id=eq.${q(id)}&user_id=eq.${q(userId)}`, { method: "DELETE", prefer: "return=minimal" });
}

export async function listMessages(userId: string, threadId: string, limit = 200): Promise<MessageRow[]> {
  if (!live()) return mem().messages.filter((m) => m.thread_id === threadId && m.user_id === userId).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-limit);
  return rest<MessageRow[]>(`chat_messages?thread_id=eq.${q(threadId)}&user_id=eq.${q(userId)}&select=id,thread_id,user_id,role,content,sources,finding,feedback,created_at&order=created_at.asc&limit=${limit}`);
}

export async function addMessage(m: Omit<MessageRow, "created_at" | "feedback" | "id"> & { id?: string }): Promise<MessageRow> {
  const row: MessageRow = { id: m.id ?? crypto.randomUUID(), feedback: null, created_at: new Date().toISOString(), ...m, content: m.content.slice(0, 20000), finding: m.finding?.slice(0, 300) ?? null };
  if (live()) await rest("chat_messages", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
  else mem().messages.push(row);
  return row;
}

/** Removes one of the user's answers (Regenerate replaces it). */
export async function deleteMessage(userId: string, threadId: string, id: string): Promise<void> {
  if (!validUuid(id)) return;
  if (!live()) {
    const m = mem();
    m.messages = m.messages.filter((x) => !(x.id === id && x.thread_id === threadId && x.user_id === userId && x.role === "assistant"));
    return;
  }
  await rest(`chat_messages?id=eq.${q(id)}&thread_id=eq.${q(threadId)}&user_id=eq.${q(userId)}&role=eq.assistant`, { method: "DELETE", prefer: "return=minimal" });
}

/** Thumbs up (1), down (-1) or cleared (null) on one of the user's answers. */
export async function setFeedback(userId: string, id: string, value: -1 | 1 | null): Promise<void> {
  if (!validUuid(id)) return;
  if (!live()) {
    const x = mem().messages.find((m) => m.id === id && m.user_id === userId && m.role === "assistant");
    if (x) x.feedback = value;
    return;
  }
  await rest(`chat_messages?id=eq.${q(id)}&user_id=eq.${q(userId)}&role=eq.assistant`, { method: "PATCH", body: JSON.stringify({ feedback: value }), prefer: "return=minimal" });
}
