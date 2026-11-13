"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { StoredScan } from "@/lib/scan/store";
import { AGENCY_UPSELL } from "./agency-modal";
import { AreaIcon } from "./icons";

/* Pagelyt Assistant: website-optimisation questions about this report, answered from the report,
   the fix guides and the blog (see lib/ai/chat.ts). The conversation lasts for the browser tab. */

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

function starters(scan: StoredScan): string[] {
  const top = [...scan.findings].sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity])[0];
  const worst = [...scan.modules].sort((a, b) => a.score - b.score)[0];
  const out = ["What should I fix first on my site?"];
  if (top) out.push(`How do I fix “${top.title}”?`);
  if (scan.vitals?.mobile?.score != null && scan.vitals.mobile.score < 90) out.push("Why is my site slow on phones, and how do I speed it up?");
  else if (worst) out.push(`How can I raise my ${worst.name} score?`);
  out.push("How do I get my site cited by ChatGPT and AI search?");
  return out.slice(0, 4);
}

export function Assistant({ scan, paid }: { scan: StoredScan; paid: boolean }) {
  // Only rendered for the owner, which is known in the browser, so sessionStorage is safe to read here.
  const [msgs, setMsgs] = useState<Msg[]>(() => (typeof window === "undefined" ? [] : load(scan.id)));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const ideas = useMemo(() => starters(scan), [scan]);

  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

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
    const history = [...msgs, { role: "user" as const, content: question }];
    update(() => [...history, { role: "assistant", content: "" }]);
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
    } catch (e) {
      if (ac.signal.aborted) update((m) => { const last = m[m.length - 1]; return last?.content ? m : m.slice(0, -2); });
      else {
        update((m) => m.slice(0, -2));
        setQ(question);
        setErr({ text: "Connection lost. Please try again." });
      }
      void e;
    } finally {
      setBusy(false);
      ctl.current = null;
      box.current?.focus();
    }
  };

  const clear = () => {
    ctl.current?.abort();
    update(() => []);
    setErr(null);
  };

  return (
    <div className="panel asst">
      <div className="asst-log" ref={log} aria-live="polite" aria-busy={busy}>
        {msgs.length === 0 ? (
          <div className="asst-empty">
            <span className="asst-badge" aria-hidden="true"><AreaIcon k="chat" size={22} /></span>
            <p><b>Ask anything about improving {scan.host}.</b> I know this report, every Pagelyt fix guide and our blog, and I stick to website optimisation: SEO, speed, accessibility, security and AI search.</p>
            <div className="asst-ideas">
              {ideas.map((t) => <button key={t} type="button" className="asst-idea" onClick={() => void ask(t)}>{t}</button>)}
            </div>
          </div>
        ) : (
          msgs.map((m, i) => (
            <div key={i} className={`asst-msg ${m.role}`}>
              {m.role === "user" ? <p>{m.content}</p> : m.content ? <Md text={m.content} /> : <p className="asst-typing" role="status"><i /><i /><i /><span className="sr-only">Writing an answer…</span></p>}
              {m.role === "assistant" && !!m.sources?.length && (
                <p className="asst-src">Sources: {m.sources.map((s, j) => <span key={s.url}>{j > 0 && " · "}<Link href={s.url} target="_blank">{s.title}</Link></span>)}</p>
              )}
            </div>
          ))
        )}
      </div>
      {err && (
        <p className="asst-err" role="alert">
          {err.text}
          {err.upgrade && !paid && <> <Link className="fnd-link" href={AGENCY_UPSELL}>See plans</Link></>}
        </p>
      )}
      <form className="asst-form" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
        <label className="sr-only" htmlFor="asst-q">Your question</label>
        <textarea
          id="asst-q"
          ref={box}
          rows={2}
          maxLength={1000}
          placeholder="e.g. How do I fix my missing meta descriptions?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(q);
            }
          }}
        />
        <div className="asst-act">
          {msgs.length > 0 && <button type="button" className="dash-btn" onClick={clear}>Clear</button>}
          {busy ? <button type="button" className="dash-btn" onClick={() => ctl.current?.abort()}>Stop</button> : <button type="submit" className="dash-btn primary" disabled={!q.trim()}>Ask</button>}
        </div>
      </form>
      <p className="panel-note asst-note">Answers are written by AI from your report and Pagelyt’s guides, so check important changes before you make them. {paid ? "Up to 100 questions a day." : "10 free questions a day."}</p>
    </div>
  );
}
