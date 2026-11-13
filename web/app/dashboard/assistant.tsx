"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { StoredScan } from "@/lib/scan/store";
import { AGENCY_UPSELL } from "./agency-modal";
import { AreaIcon } from "./icons";

/* Pagelyt Assistant: website-optimisation questions about this report, answered from the report,
   the fix guides and the blog (see lib/ai/chat.ts). The conversation lasts for the browser tab and is
   shared by the full "Ask Pagelyt" view and the small chat widget (only one of them is ever on screen). */

type Msg = { role: "user" | "assistant"; content: string; sources?: { title: string; url: string }[] };

const KEY = (id: string) => `pagelyt-chat:${id}`;
const load = (id: string): Msg[] => {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY(id)) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const save = (id: string, m: Msg[]) => {
  try {
    sessionStorage.setItem(KEY(id), JSON.stringify(m.slice(-30)));
  } catch {}
};
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

type Group = { title: string; icon: "list" | "performance" | "ai"; qs: string[] };

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
    { title: "About your report", icon: "list", qs: report },
    { title: "Speed and SEO", icon: "performance", qs: speed },
    { title: "AI search", icon: "ai", qs: ai },
  ];
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="asst-tool"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        });
      }}
      aria-label={done ? "Copied" : "Copy answer"}
    >
      {done ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></svg>
      )}
      <span>{done ? "Copied" : "Copy"}</span>
    </button>
  );
}

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
  const [msgs, setMsgs] = useState<Msg[]>(() => (typeof window === "undefined" ? [] : load(scan.id)));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [away, setAway] = useState(false); // the reader has scrolled up from the newest message
  const ctl = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true); // follow the answer as it streams, unless the reader scrolled up to read
  const groups = useMemo(() => starters(scan), [scan]);
  const asked = new Set(msgs.filter((m) => m.role === "user").map((m) => m.content));
  const next = groups.flatMap((g) => g.qs).filter((x) => !asked.has(x)).slice(0, mini ? 2 : 3);
  const uid = mini ? "asst-q-mini" : "asst-q";

  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => {
    if (mini) box.current?.focus();
  }, [mini]);

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

  const update = (fn: (m: Msg[]) => Msg[]) =>
    setMsgs((m) => {
      const next = fn(m);
      save(scan.id, next);
      return next;
    });

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    if (question.length > 1000) return setErr({ text: "Please keep questions under 1,000 characters." });
    setErr(null);
    setQ("");
    stick.current = true;
    setAway(false);
    const history = [...msgs, { role: "user" as const, content: question }];
    update(() => [...history, { role: "assistant", content: "" }]);
    requestAnimationFrame(() => toBottom(true));
    setBusy(true);
    const ac = new AbortController();
    ctl.current = ac;
    try {
      const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ scanId: scan.id, messages: history.slice(-10).map(({ role, content }) => ({ role, content })) }),
        signal: ac.signal,
      });
      if (!r.ok || !r.body) {
        const j = (await r.json().catch(() => ({}))) as { error?: string; upgrade?: boolean };
        update((m) => m.slice(0, -2));
        setQ(question);
        setErr({ text: j.error || "The assistant couldn't answer just now.", upgrade: j.upgrade });
        return;
      }
      let sources: Msg["sources"] = [];
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
        const now = answer;
        update((m) => [...m.slice(0, -1), { role: "assistant", content: now }]);
      }
      update((m) => [...m.slice(0, -1), { role: "assistant", content: answer || "Sorry, I couldn't write an answer. Please try again.", sources }]);
    } catch {
      if (ac.signal.aborted) update((m) => { const last = m[m.length - 1]; return last?.content ? m : m.slice(0, -2); });
      else {
        update((m) => m.slice(0, -2));
        setQ(question);
        setErr({ text: "Connection lost. Please try again." });
      }
    } finally {
      setBusy(false);
      ctl.current = null;
      box.current?.focus({ preventScroll: true });
    }
  };

  const clear = () => {
    ctl.current?.abort();
    update(() => []);
    setErr(null);
  };

  const lastAnswer = msgs.length > 1 && msgs[msgs.length - 1].role === "assistant" ? msgs.length - 1 : -1;

  return (
    <div className={`panel asst${mini ? " asst-mini" : ""}`}>
      <header className="asst-head">
        <span className="asst-badge" aria-hidden="true"><AreaIcon k="chat" size={mini ? 18 : 20} /></span>
        <div className="asst-title">
          <b>Ask Pagelyt</b>
          <span>{scan.host} · score {scan.overall}</span>
        </div>
        <div className="asst-head-act">
          {msgs.length > 0 && (
            <button type="button" className="asst-tool" onClick={clear} title="Start a new conversation">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" /></svg>
              <span>New chat</span>
            </button>
          )}
          {onExpand && (
            <button type="button" className="asst-icon" onClick={onExpand} disabled={busy} aria-label="Open the full Ask Pagelyt view" title={busy ? "Wait for the answer to finish" : "Open full view"}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
            </button>
          )}
          {onClose && (
            <button type="button" className="asst-icon" onClick={onClose} aria-label="Close chat">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          )}
        </div>
      </header>

      <div className="asst-log" ref={log} onScroll={onScroll} aria-live="polite" aria-busy={busy}>
        {msgs.length === 0 ? (
          <div className="asst-empty">
            <p className="asst-hello"><b>Hi! Ask anything about improving {scan.host}.</b> I know this report, every Pagelyt fix guide and our blog. I only answer website-optimisation questions: SEO, speed, accessibility, security and AI search.</p>
            {(mini ? groups.slice(0, 1).concat({ ...groups[2], qs: groups[2].qs.slice(0, 1) }) : groups).map((g) => (
              <div key={g.title} className="asst-group">
                <p className="asst-gh"><AreaIcon k={g.icon} size={15} />{g.title}</p>
                <div className="asst-ideas">
                  {g.qs.map((t) => <button key={t} type="button" className="asst-idea" onClick={() => void ask(t)}>{t}</button>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={`asst-msg ${m.role}`}>
              {m.role === "user" ? <p>{m.content}</p> : m.content ? <Md text={m.content} /> : <p className="asst-typing" role="status"><i /><i /><i /><span className="sr-only">Writing an answer…</span></p>}
              {m.role === "assistant" && !!m.content && !(busy && i === msgs.length - 1) && (
                <div className="asst-foot">
                  {!!m.sources?.length && (
                    <p className="asst-src"><span>Sources</span>{m.sources.map((s) => <Link key={s.url} href={s.url} target="_blank">{s.title}</Link>)}</p>
                  )}
                  <CopyBtn text={m.content} />
                </div>
              )}
              {i === lastAnswer && !busy && next.length > 0 && (
                <div className="asst-next" aria-label="Suggested follow-up questions">
                  {next.map((t) => <button key={t} type="button" className="asst-idea" onClick={() => void ask(t)}>{t}</button>)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="asst-bottom">
        {away && msgs.length > 0 && (
          <button type="button" className="asst-jump" onClick={() => { stick.current = true; setAway(false); toBottom(true); }} aria-label="Scroll to the newest message">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
          </button>
        )}
        {err && (
          <p className="asst-err" role="alert">
            {err.text}
            {err.upgrade && !paid && <> <Link className="fnd-link" href={AGENCY_UPSELL}>See plans</Link></>}
          </p>
        )}
        <form className="asst-form" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
          <label className="sr-only" htmlFor={uid}>Your question</label>
          <textarea
            id={uid}
            ref={box}
            rows={1}
            maxLength={1000}
            placeholder={mini ? "Ask about your site…" : "Ask about SEO, speed, accessibility, security or AI search…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void ask(q);
              }
            }}
          />
          {busy ? (
            <button type="button" className="asst-send stop" onClick={() => ctl.current?.abort()} aria-label="Stop the answer">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
            </button>
          ) : (
            <button type="submit" className="asst-send" disabled={!q.trim()} aria-label="Ask">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg>
            </button>
          )}
        </form>
        <p className="asst-note">
          {mini ? "AI answers from your report and our guides; check before changing your site." : "Answers are written by AI from your report and Pagelyt’s guides, so check important changes before you make them."}{" "}
          {paid ? "Up to 100 questions a day." : "10 free questions a day."}
        </p>
      </div>
    </div>
  );
}
