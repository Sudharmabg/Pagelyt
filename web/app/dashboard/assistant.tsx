"use client";

import { toast } from "../toast";
import { CopyButton } from "@/components/avara/CopyButtonBlock";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { StoredScan } from "@/lib/scan/store";
import type { Finding } from "@/lib/scan/types";
import { AGENCY_UPSELL } from "./agency-modal";
import { AreaIcon } from "./icons";

/* Pagelyt Assistant: website-optimisation questions about this report, answered from the report, the fix guides and
   the blog (see lib/ai/chat.ts). Every question and answer is saved to the owner's account per site (api/chat,
   migration 0015); History lists the saved chats and the last one reopens. The open chat is also cached for the tab,
   so the full "Ask Pagelyt" view and the small chat widget (only one of them is ever on screen) share it instantly.
   Extras: thumbs up/down and Regenerate on answers, "+ Finding" to ask about one of the report's findings, and voice
   input where the browser has speech recognition. */

type Source = { title: string; url: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; sources?: Source[]; finding?: string; feedback?: 1 | -1 | null; time?: string };
type Thread = { id: string; title: string; updatedAt: string };
type Cache = { t: string | null; m: Msg[] };

const KEY = (id: string) => `pagelyt-chat:${id}`;
const load = (id: string): Cache | null => {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY(id)) ?? "null");
    if (Array.isArray(v)) return { t: null, m: v }; // the older cache shape: just the messages
    return v && Array.isArray(v.m) ? { t: typeof v.t === "string" ? v.t : null, m: v.m } : null;
  } catch {
    return null;
  }
};
const save = (id: string, c: Cache) => {
  try {
    sessionStorage.setItem(KEY(id), JSON.stringify({ t: c.t, m: c.m.slice(-40) }));
  } catch {}
};
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const auth = async (): Promise<Record<string, string>> => {
  const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
};
const clock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

/* Small, safe markdown: paragraphs, lists, fenced code, **bold**, `code` and links to our own pages or https. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((s, i) => {
        const b = /^\*\*([^*]+)\*\*$/.exec(s);
        if (b) return <strong key={i}>{b[1]}</strong>;
        const c = /^`([^`]+)`$/.exec(s);
        if (c) return <code key={i}>{c[1]}</code>;
        const l = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(s);
        if (l && /^\/(?!\/)/.test(l[2])) return <Link key={i} href={l[2]} target="_blank">{l[1]}</Link>;
        if (l && /^https:\/\//.test(l[2])) return <a key={i} href={l[2]} target="_blank" rel="noopener noreferrer nofollow">{l[1]}</a>;
        return s;
      })}
    </>
  );
}

function Md({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  const chunks = text.split(/(```[\s\S]*?(?:```|$))/g);
  chunks.forEach((chunk, ci) => {
    if (chunk.startsWith("```")) {
      out.push(<pre key={`c${ci}`}><code>{chunk.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}</code></pre>);
      return;
    }
    for (const [bi, block] of chunk.split(/\n{2,}/).entries()) {
      const lines = block.split("\n").filter((l) => l.trim());
      if (!lines.length) continue;
      const k = `b${ci}-${bi}`;
      if (lines.every((l) => /^\s*[-*] /.test(l))) out.push(<ul key={k}>{lines.map((l, i) => <li key={i}><Inline text={l.replace(/^\s*[-*] /, "")} /></li>)}</ul>);
      else if (lines.every((l) => /^\s*\d+[.)] /.test(l))) out.push(<ol key={k}>{lines.map((l, i) => <li key={i}><Inline text={l.replace(/^\s*\d+[.)] /, "")} /></li>)}</ol>);
      else out.push(<p key={k}>{lines.map((l, i) => <span key={i}>{i > 0 && <br />}<Inline text={l.replace(/^#+\s*/, "")} /></span>)}</p>);
    }
  });
  return <>{out}</>;
}

type Group = { title: string; icon: "list" | "performance" | "ai"; color: string; qs: string[] };

/** Starter questions, built from this report so the first answer is about the person's own site. */
function starters(scan: StoredScan): Group[] {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const top = [...scan.findings].sort((a, b) => rank[a.severity] - rank[b.severity]);
  const worst = [...scan.modules].sort((a, b) => a.score - b.score)[0];
  const report = ["What should I fix first on my site?"];
  if (top[0]) report.push(`How do I fix “${top[0].title}”?`);
  if (worst) report.push(`How can I raise my ${worst.name} score?`);
  const speed: string[] = [];
  if (scan.vitals?.mobile?.score != null && scan.vitals.mobile.score < 90) speed.push("Why is my site slow on phones, and how do I speed it up?");
  else speed.push("How can I make my pages load faster?");
  speed.push("Which quick wins would help my Google rankings most?");
  const ai = ["How do I get my site cited by ChatGPT and AI search?", "What structured data should my site have?"];
  return [
    { title: "About your report", icon: "list", color: "#7b3fe0", qs: report },
    { title: "Speed and SEO", icon: "performance", color: "#e0620d", qs: speed },
    { title: "AI search", icon: "ai", color: "#c2378e", qs: ai },
  ];
}

/** Which day group a saved chat goes under in History. */
function dayGroup(iso: string): string {
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t = d.getTime();
  if (t >= start.getTime()) return "Today";
  if (t >= start.getTime() - 86_400_000) return "Yesterday";
  if (t >= start.getTime() - 6 * 86_400_000) return "Previous 7 days";
  return "Earlier";
}

/* Browser speech recognition (Chrome, Edge, Safari). Typed loosely: it isn't in the TypeScript DOM library. */
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const recCtor = (): (new () => Rec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const Svg = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={fill ? "fill" : undefined}><path d={d} /></svg>
);
const I = {
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  plus: "M12 5v14M5 12h14",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3",
  up: "M7 10v11M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.4 21H7V10l4.3-6.9A1.6 1.6 0 0 1 14.2 4c.6.4.9 1.2.8 1.9Z",
  down: "M17 14V3M9 18.1l1 -4.1H4.2a2 2 0 0 1-2-2.3l1.4-7A2 2 0 0 1 5.6 3H17v11l-4.3 6.9a1.6 1.6 0 0 1-2.9-.9c-.6-.4-.9-1.2-.8-1.9Z",
  redo: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  x: "M6 6l12 12M18 6 6 18",
  expand: "M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7",
  send: "M12 19V5M5.5 11.5 12 5l6.5 6.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  down2: "M12 5v14M6 13l6 6 6-6",
  newc: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
};

type Props = {
  scan: StoredScan;
  paid: boolean;
  /** The small chat widget: compact layout, with buttons to open the full view and to close. */
  mini?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
};

export function Assistant({ scan, paid, mini, onExpand, onClose }: Props) {
  // Only rendered for the owner, which is known in the browser, so sessionStorage is safe to read here.
  const [cache] = useState<Cache | null>(() => (typeof window === "undefined" ? null : load(scan.id)));
  const [msgs, setMsgs] = useState<Msg[]>(cache?.m ?? []);
  const [threadId, setThreadId] = useState<string | null>(cache?.t ?? null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [away, setAway] = useState(false); // the reader has scrolled up from the newest message
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [hist, setHist] = useState(false);
  const [opening, setOpening] = useState(!cache); // first open in this tab: reopening the last saved chat
  const [finding, setFinding] = useState<string | null>(null);
  const [pick, setPick] = useState(false);
  const [pickQ, setPickQ] = useState("");
  const [canTalk, setCanTalk] = useState(false);
  const [listening, setListening] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const rec = useRef<Rec | null>(null);
  const histRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef<HTMLDivElement>(null);
  const tid = useRef(threadId);
  const stick = useRef(true); // follow the answer as it streams, unless the reader scrolled up to read
  const groups = useMemo(() => starters(scan), [scan]);
  const asked = new Set(msgs.filter((m) => m.role === "user").map((m) => m.content));
  const next = groups.flatMap((g) => g.qs).filter((x) => !asked.has(x)).slice(0, mini ? 2 : 3);
  const uid = mini ? "asst-q-mini" : "asst-q";

  const findings = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    const needle = pickQ.trim().toLowerCase();
    return [...scan.findings].sort((a, b) => rank[a.severity] - rank[b.severity]).filter((f) => !needle || `${f.title} ${f.module}`.toLowerCase().includes(needle));
  }, [scan.findings, pickQ]);

  useEffect(() => () => {
    ctl.current?.abort();
    rec.current?.stop();
  }, []);
  useEffect(() => {
    if (mini) box.current?.focus();
  }, [mini]);
  useEffect(() => setCanTalk(!!recCtor()), []);

  // First open in this tab: reopen the newest saved chat for this site.
  useEffect(() => {
    if (cache) return;
    let live = true;
    (async () => {
      try {
        const r = await fetch(`/api/chat/threads?scanId=${encodeURIComponent(scan.id)}`, { headers: await auth() });
        const j = (await r.json().catch(() => ({}))) as { threads?: Thread[] };
        if (!live) return;
        const list = j.threads ?? [];
        setThreads(list);
        if (list[0]) await open(list[0].id, () => live);
      } finally {
        if (live) setOpening(false);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the History list and the finding picker on a click outside them or Escape.
  useEffect(() => {
    if (!hist && !pick) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (hist && histRef.current && !histRef.current.contains(t)) setHist(false);
      if (pick && pickRef.current && !pickRef.current.contains(t)) setPick(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setHist(false);
      setPick(false);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key, true);
    };
  }, [hist, pick]);

  const toBottom = (smooth: boolean) => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced() ? "smooth" : "auto" });
  };
  // Keep the newest text in view while it streams in; jumping is instant so it never lags behind the text.
  useLayoutEffect(() => {
    if (stick.current && msgs.length) toBottom(false);
  }, [msgs]);

  const onScroll = () => {
    const el = log.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    stick.current = near;
    setAway(!near);
  };

  // The question box grows with the text, up to a few lines.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, mini ? 120 : 180)}px`;
  }, [q, mini]);

  const setThread = (id: string | null) => {
    tid.current = id;
    setThreadId(id);
  };
  const update = (fn: (m: Msg[]) => Msg[]) =>
    setMsgs((m) => {
      const n = fn(m);
      save(scan.id, { t: tid.current, m: n });
      return n;
    });

  async function open(id: string, still: () => boolean = () => true) {
    const r = await fetch(`/api/chat/threads/${id}`, { headers: await auth() });
    if (!r.ok || !still()) return;
    const j = (await r.json()) as { messages: Msg[] };
    ctl.current?.abort();
    setThread(id);
    stick.current = true;
    update(() => j.messages);
    setErr(null);
  }

  const loadThreads = async () => {
    try {
      const r = await fetch(`/api/chat/threads?scanId=${encodeURIComponent(scan.id)}`, { headers: await auth() });
      const j = (await r.json().catch(() => ({}))) as { threads?: Thread[] };
      setThreads(j.threads ?? []);
    } catch {
      setThreads([]);
    }
  };

  const ask = async (text: string, opt: { finding?: string | null; replace?: string; base?: Msg[] } = {}) => {
    const question = text.trim();
    if (!question || busy) return;
    if (question.length > 1000) return setErr({ text: "Please keep questions under 1,000 characters." });
    rec.current?.stop();
    setErr(null);
    setPick(false);
    const about = opt.finding !== undefined ? opt.finding : finding;
    const before = msgs;
    const now = new Date().toISOString();
    const history: Msg[] = opt.base ?? [...msgs, { role: "user", content: question, finding: about ?? undefined, time: now }];
    if (!opt.base) {
      setQ("");
      setFinding(null);
    }
    stick.current = true;
    setAway(false);
    update(() => [...history, { role: "assistant", content: "", time: now }]);
    requestAnimationFrame(() => toBottom(true));
    setBusy(true);
    const ac = new AbortController();
    ctl.current = ac;
    let answerId: string | undefined;
    let sources: Source[] = [];
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await auth()) },
        body: JSON.stringify({ scanId: scan.id, threadId: tid.current, finding: about, replace: opt.replace, messages: history.slice(-10).map(({ role, content }) => ({ role, content })) }),
        signal: ac.signal,
      });
      if (!r.ok || !r.body) {
        const j = (await r.json().catch(() => ({}))) as { error?: string; upgrade?: boolean };
        update(() => before);
        if (!opt.base) {
          setQ(question);
          setFinding(about);
        }
        setErr({ text: j.error || "The assistant couldn't answer just now.", upgrade: j.upgrade });
        return;
      }
      const t = r.headers.get("x-chat-thread");
      if (t && t !== tid.current) {
        setThread(t);
        setThreads((l) => (l ? [{ id: t, title: question.slice(0, 60), updatedAt: now }, ...l.filter((x) => x.id !== t)] : l));
      }
      answerId = r.headers.get("x-chat-answer") ?? undefined;
      try {
        sources = JSON.parse(decodeURIComponent(r.headers.get("x-chat-sources") ?? "%5B%5D"));
      } catch {}
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += dec.decode(value, { stream: true });
        const nowText = answer;
        update((m) => [...m.slice(0, -1), { role: "assistant", content: nowText, time: now }]);
      }
      update((m) => [...m.slice(0, -1), { id: answerId, role: "assistant", content: answer || "Sorry, I couldn't write an answer. Please try again.", sources, feedback: null, time: new Date().toISOString() }]);
    } catch {
      if (ac.signal.aborted)
        update((m) => {
          const last = m[m.length - 1];
          return last?.content ? [...m.slice(0, -1), { ...last, id: answerId, sources, feedback: null }] : before;
        });
      else {
        update(() => before);
        if (!opt.base) {
          setQ(question);
          setFinding(about);
        }
        setErr({ text: "Connection lost. Please try again." });
      }
    } finally {
      setBusy(false);
      ctl.current = null;
      box.current?.focus({ preventScroll: true });
    }
  };

  /** Asks the last question again; the server deletes the old answer and saves the new one. */
  const regenerate = () => {
    const a = msgs[msgs.length - 1];
    const u = msgs[msgs.length - 2];
    if (!a || a.role !== "assistant" || !u || u.role !== "user" || busy) return;
    void ask(u.content, { finding: u.finding ?? null, replace: a.id, base: msgs.slice(0, -1) });
  };

  const rate = async (i: number, v: 1 | -1) => {
    const m = msgs[i];
    if (!m?.id) return;
    const value = m.feedback === v ? null : v;
    update((all) => all.map((x, j) => (j === i ? { ...x, feedback: value } : x)));
    if (value) toast(value === 1 ? "Thanks, glad it helped" : "Thanks, we'll use this to improve answers");
    try {
      await fetch("/api/chat/feedback", { method: "POST", headers: { "content-type": "application/json", ...(await auth()) }, body: JSON.stringify({ messageId: m.id, value: value ?? 0 }) });
    } catch {}
  };

  const newChat = () => {
    ctl.current?.abort();
    setThread(null);
    update(() => []);
    setErr(null);
    setHist(false);
    setFinding(null);
    box.current?.focus();
  };

  const remove = async (id: string) => {
    setThreads((l) => l?.filter((t) => t.id !== id) ?? l);
    if (id === tid.current) newChat();
    try {
      await fetch(`/api/chat/threads/${id}`, { method: "DELETE", headers: await auth() });
      toast("Chat deleted");
    } catch {}
  };

  const talk = () => {
    if (listening) return rec.current?.stop();
    const C = recCtor();
    if (!C) return;
    const r = new C();
    r.lang = navigator.language || "en-GB";
    r.interimResults = true;
    r.continuous = false;
    const base = q.trim();
    r.onresult = (e) => {
      const said = Array.from(e.results, (x) => x[0]?.transcript ?? "").join("");
      setQ(`${base}${base && said ? " " : ""}${said}`.slice(0, 1000));
    };
    r.onend = () => setListening(false);
    r.onerror = () => {
      setListening(false);
      toast("Couldn't hear that. Check the microphone permission.");
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };

  const choose = (f: Finding) => {
    setFinding(f.title);
    setPick(false);
    setPickQ("");
    if (!q.trim()) setQ("How do I fix this?");
    requestAnimationFrame(() => box.current?.focus());
  };

  const lastAnswer = msgs.length > 1 && msgs[msgs.length - 1].role === "assistant" ? msgs.length - 1 : -1;
  const grouped = (threads ?? []).reduce<[string, Thread[]][]>((acc, t) => {
    const g = dayGroup(t.updatedAt);
    const hit = acc.find(([k]) => k === g);
    if (hit) hit[1].push(t);
    else acc.push([g, [t]]);
    return acc;
  }, []);
  const sev = { high: "Important", medium: "Worth fixing", low: "Minor" } as const;

  return (
    <div className={`panel asst${mini ? " asst-mini" : ""}`}>
      <header className="asst-head">
        <span className="asst-badge" aria-hidden="true"><AreaIcon k="chat" size={mini ? 18 : 20} /></span>
        <div className="asst-title">
          <b>Ask Pagelyt</b>
          <span><i className="asst-live" aria-hidden="true" />Knows {scan.host}&rsquo;s report · score {scan.overall}</span>
        </div>
        <div className="asst-head-act">
          <div className="asst-hist" ref={histRef}>
            <button
              type="button"
              className={`asst-tool${hist ? " on" : ""}`}
              aria-expanded={hist}
              aria-haspopup="true"
              onClick={() => {
                setHist((v) => !v);
                if (!hist) void loadThreads();
              }}
              title="Your saved chats for this site"
            >
              <Svg d={I.history} />
              <span>History</span>
            </button>
            {hist && (
              <div className="asst-hist-pop" role="dialog" aria-label="Saved chats">
                <button type="button" className="asst-hist-new" onClick={newChat}>
                  <Svg d={I.plus} /> New chat
                </button>
                {threads === null ? (
                  <p className="asst-hist-empty">Loading…</p>
                ) : threads.length === 0 ? (
                  <p className="asst-hist-empty">No saved chats yet. Your questions about {scan.host} are kept here.</p>
                ) : (
                  <div className="asst-hist-list">
                    {grouped.map(([g, list]) => (
                      <div key={g}>
                        <p className="asst-hist-g">{g}</p>
                        <ul>
                          {list.map((t) => (
                            <li key={t.id} className={t.id === threadId ? "on" : undefined}>
                              <button
                                type="button"
                                className="asst-hist-item"
                                onClick={() => {
                                  setHist(false);
                                  if (t.id !== threadId) void open(t.id);
                                }}
                              >
                                <AreaIcon k="chat" size={14} />
                                <span>{t.title}</span>
                              </button>
                              <button type="button" className="asst-hist-del" aria-label={`Delete “${t.title}”`} title="Delete chat" onClick={() => void remove(t.id)}>
                                <Svg d={I.trash} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {msgs.length > 0 && (
            <button type="button" className="asst-tool asst-tool-new" onClick={newChat} title="Start a new conversation">
              <Svg d={I.newc} />
              <span>New chat</span>
            </button>
          )}
          {onExpand && (
            <button type="button" className="asst-icon" onClick={onExpand} disabled={busy} aria-label="Open the full Ask Pagelyt view" title={busy ? "Wait for the answer to finish" : "Open full view"}>
              <Svg d={I.expand} />
            </button>
          )}
          {onClose && (
            <button type="button" className="asst-icon" onClick={onClose} aria-label="Close chat">
              <Svg d={I.x} />
            </button>
          )}
        </div>
      </header>

      <div className="asst-log" ref={log} onScroll={onScroll} aria-live="polite" aria-busy={busy || opening}>
        {msgs.length === 0 ? (
          opening ? (
            <div className="asst-opening" role="status"><span className="asst-orb sm" aria-hidden="true" /> Opening your last chat…</div>
          ) : (
            <div className="asst-empty">
              <div className="asst-hello">
                <span className="asst-orb" aria-hidden="true"><AreaIcon k="chat" size={mini ? 20 : 26} /></span>
                <div>
                  <p className="asst-hi">Hi! Ask anything about improving <span>{scan.host}</span>.</p>
                  <p>I know this report, every Pagelyt fix guide and our blog. I only answer website-optimisation questions: SEO, speed, accessibility, security and AI search.</p>
                </div>
              </div>
              <div className="asst-cards">
                {(mini ? groups.slice(0, 1).concat({ ...groups[2], qs: groups[2].qs.slice(0, 1) }) : groups).map((g, gi) => (
                  <section key={g.title} className="asst-card" style={{ ["--c" as string]: g.color, ["--i" as string]: gi }} aria-label={g.title}>
                    <p className="asst-gh"><span><AreaIcon k={g.icon} size={15} /></span>{g.title}</p>
                    {g.qs.map((t) => (
                      <button key={t} type="button" className="asst-idea" onClick={() => void ask(t, { finding: null })}>
                        <span>{t}</span>
                        <Svg d={I.arrow} />
                      </button>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          )
        ) : (
          msgs.map((m, i) => (
            <div key={m.id ?? i} className={`asst-row ${m.role}`}>
              {m.role === "assistant" && <span className="asst-av" aria-hidden="true"><AreaIcon k="chat" size={14} /></span>}
              <div className="asst-col">
                <div className={`asst-msg ${m.role}`}>
                  {m.role === "user" ? (
                    <>
                      {m.finding && <span className="asst-about"><b>About</b> {m.finding}</span>}
                      <p>{m.content}</p>
                    </>
                  ) : m.content ? (
                    <Md text={m.content} />
                  ) : (
                    <p className="asst-typing" role="status"><span className="asst-shimmer">Pagelyt is thinking</span><i /><i /><i /></p>
                  )}
                </div>
                {m.role === "assistant" && !!m.sources?.length && !!m.content && !(busy && i === msgs.length - 1) && (
                  <p className="asst-src"><span>Sources</span>{m.sources.map((s) => <Link key={s.url} href={s.url} target="_blank">{s.title}</Link>)}</p>
                )}
                {!!m.content && !(busy && i === msgs.length - 1) && (
                  <div className="asst-meta">
                    {m.time && <time dateTime={m.time}>{clock(m.time)}</time>}
                    {m.role === "assistant" && (
                      <>
                        <CopyButton value={m.content} size="sm" variant="ghost" className="asst-act h-7 px-2 text-xs" onCopy={(_, ok) => ok && toast("Answer copied")} />
                        {m.id && (
                          <>
                            <button type="button" className={`asst-act${m.feedback === 1 ? " on up" : ""}`} aria-pressed={m.feedback === 1} aria-label="Good answer" title="Good answer" onClick={() => void rate(i, 1)}><Svg d={I.up} /></button>
                            <button type="button" className={`asst-act${m.feedback === -1 ? " on down" : ""}`} aria-pressed={m.feedback === -1} aria-label="Bad answer" title="Bad answer" onClick={() => void rate(i, -1)}><Svg d={I.down} /></button>
                          </>
                        )}
                        {i === lastAnswer && !busy && (
                          <button type="button" className="asst-act asst-regen" onClick={regenerate} title="Write this answer again"><Svg d={I.redo} /><span>Regenerate</span></button>
                        )}
                      </>
                    )}
                  </div>
                )}
                {i === lastAnswer && !busy && next.length > 0 && (
                  <div className="asst-next" aria-label="Suggested follow-up questions">
                    {next.map((t) => <button key={t} type="button" className="asst-chip" onClick={() => void ask(t, { finding: null })}>{t}</button>)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="asst-bottom">
        {away && msgs.length > 0 && (
          <button type="button" className="asst-jump" onClick={() => { stick.current = true; setAway(false); toBottom(true); }} aria-label="Scroll to the newest message">
            <Svg d={I.down2} />
          </button>
        )}
        {err && (
          <p className="asst-err" role="alert">
            {err.text}
            {err.upgrade && !paid && <> <Link className="fnd-link" href={AGENCY_UPSELL}>See plans</Link></>}
          </p>
        )}
        <form className={`asst-form${listening ? " listening" : ""}`} onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
          {finding && (
            <div className="asst-fsel">
              <span className="asst-fsel-ico" aria-hidden="true"><Svg d={I.plus} /></span>
              <span className="asst-fsel-t"><b>About</b> {finding}</span>
              <button type="button" aria-label="Remove the finding" onClick={() => setFinding(null)}><Svg d={I.x} /></button>
            </div>
          )}
          <label className="sr-only" htmlFor={uid}>Your question</label>
          <textarea
            id={uid}
            ref={box}
            rows={1}
            maxLength={1000}
            placeholder={listening ? "Listening… speak your question" : mini ? "Ask about your site…" : "Ask about SEO, speed, accessibility, security or AI search…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void ask(q);
              }
            }}
          />
          <div className="asst-tools">
            <div className="asst-pick" ref={pickRef}>
              <button type="button" className={`asst-tbtn${pick ? " on" : ""}`} aria-expanded={pick} aria-haspopup="true" onClick={() => setPick((v) => !v)} title="Ask about one of this report's findings">
                <Svg d={I.plus} />
                <span>Finding</span>
              </button>
              {pick && (
                <div className="asst-pick-pop" role="dialog" aria-label="Pick a finding to ask about">
                  <div className="asst-pick-head">
                    <b>Ask about a finding</b>
                    <button type="button" className="asst-icon" aria-label="Close" onClick={() => setPick(false)}><Svg d={I.x} /></button>
                  </div>
                  <input autoFocus className="asst-pick-q" placeholder="Search findings…" aria-label="Search findings" value={pickQ} onChange={(e) => setPickQ(e.target.value)} />
                  <ul className="asst-pick-list">
                    {findings.length === 0 && <li className="asst-pick-none">No findings match.</li>}
                    {findings.map((f, fi) => (
                      <li key={`${f.id}-${fi}`}>
                        {(fi === 0 || findings[fi - 1].severity !== f.severity) && <p className={`asst-pick-g sev-${f.severity}`}>{sev[f.severity]}</p>}
                        <button type="button" onClick={() => choose(f)}>
                          <span className={`asst-pick-ico sev-${f.severity}`}><AreaIcon k={f.module} size={14} /></span>
                          <span className="asst-pick-t">{f.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {canTalk && (
              <button type="button" className={`asst-tbtn asst-mic${listening ? " on" : ""}`} onClick={talk} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Ask by voice"} title={listening ? "Stop listening" : "Ask by voice"}>
                <Svg d={I.mic} />
              </button>
            )}
            {q.length > 0 && <span className={`asst-count${q.length > 900 ? " near" : ""}`}>{q.length}/1000</span>}
            {busy ? (
              <button type="button" className="asst-send stop" onClick={() => ctl.current?.abort()} aria-label="Stop the answer">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
              </button>
            ) : (
              <button type="submit" className="asst-send" disabled={!q.trim()} aria-label="Ask">
                <Svg d={I.send} />
              </button>
            )}
          </div>
        </form>
        <p className="asst-note">
          {mini ? "AI answers from your report and our guides; check before changing your site." : "Answers are written by AI from your report and Pagelyt’s guides, so check important changes before you make them."}{" "}
          {paid ? "Up to 100 questions a day." : "10 free questions a day."}
        </p>
      </div>
    </div>
  );
}
