"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { visibilityScore } from "@/lib/ai/analyse";
import { PROVIDER } from "@/lib/ai/providers";

type Site = { id: string; host: string; brand_terms: string[]; competitors: string[]; ai_track: boolean };
type Prompt = { id: string; prompt: string };
type Run = { id: number; prompt_id: string; provider: string; at: string; mentioned: boolean; cited: boolean; position: number | null; competitor_counts: Record<string, number>; answer: string | null; citations: string[]; error: string | null };
type Provider = { id: string; label: string };

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12);

function Trend({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 160, h = 44;
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * (w - 8) + 4},${h - 6 - (v / 100) * (h - 12)}`);
  const last = pts[pts.length - 1].split(",");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Visibility over time: ${points.join(", ")} percent`}>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="currentColor" />
    </svg>
  );
}

export function Visibility({ siteId }: { siteId: string }) {
  const sb = supabaseBrowser();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [site, setSite] = useState<Site | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [terms, setTerms] = useState("");
  const [comps, setComps] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [category, setCategory] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!sb) return;
    const [s, p, r] = await Promise.all([
      sb.from("sites").select("id,host,brand_terms,competitors,ai_track").eq("id", siteId).maybeSingle(),
      sb.from("ai_prompts").select("id,prompt").eq("site_id", siteId).order("created_at"),
      sb.from("ai_runs").select("id,prompt_id,provider,at,mentioned,cited,position,competitor_counts,answer,citations,error").eq("site_id", siteId).eq("provider", PROVIDER.id).order("at", { ascending: false }).limit(300),
    ]);
    const st = s.data as Site | null;
    setSite(st);
    if (st) {
      setTerms((st.brand_terms ?? []).join(", "));
      setComps((st.competitors ?? []).join(", "));
    }
    setPrompts((p.data as Prompt[]) ?? []);
    setRuns((r.data as Run[]) ?? []);
  }, [sb, siteId]);

  useEffect(() => {
    if (!sb) return;
    fetch("/api/ai/run").then((r) => r.json()).then((j) => setProviders(j.providers ?? [])).catch(() => {});
    sb.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      if (data.session) void load();
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSignedIn(!!s);
      if (s) void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [sb, load]);

  /* latest ChatGPT result per prompt */
  const latest = useMemo(() => {
    const m = new Map<string, Run>();
    for (const r of runs) if (!m.has(`${r.prompt_id}:${r.provider}`)) m.set(`${r.prompt_id}:${r.provider}`, r);
    return m;
  }, [runs]);
  const latestList = useMemo(() => [...latest.values()].filter((r) => prompts.some((p) => p.id === r.prompt_id)), [latest, prompts]);
  // ChatGPT is the only assistant we ask; older runs from other providers are filtered out in load().
  const cols = [PROVIDER];

  const score = visibilityScore(latestList);
  const okRuns = latestList.filter((r) => !r.error);
  const citedPct = okRuns.length ? Math.round((okRuns.filter((r) => r.cited).length / okRuns.length) * 100) : null;
  const positions = okRuns.filter((r) => r.position != null).map((r) => r.position!);
  const avgPos = positions.length ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1) : null;

  const trend = useMemo(() => {
    const byDay = new Map<string, Run[]>();
    for (const r of [...runs].reverse()) byDay.set(r.at.slice(0, 10), [...(byDay.get(r.at.slice(0, 10)) ?? []), r]);
    return [...byDay.values()].map((d) => visibilityScore(d)).filter((x): x is number => x !== null).slice(-20);
  }, [runs]);

  const voice = useMemo(() => {
    const brand = okRuns.filter((r) => r.mentioned).length;
    const comp = new Map<string, number>();
    for (const r of okRuns) for (const [k, n] of Object.entries(r.competitor_counts ?? {})) if (n > 0) comp.set(k, (comp.get(k) ?? 0) + 1);
    const rows = [{ name: site?.host ?? "You", n: brand, you: true }, ...[...comp].map(([name, n]) => ({ name, n, you: false }))].sort((a, b) => b.n - a.n);
    return { rows, max: Math.max(1, ...rows.map((r) => r.n)), total: okRuns.length };
  }, [okRuns, site]);

  const saveSettings = async () => {
    const { error } = await sb!.from("sites").update({ brand_terms: list(terms), competitors: list(comps) }).eq("id", siteId);
    setMsg(error ? error.message : "Saved. New runs will use these names.");
    void load();
  };

  const toggleTrack = async (on: boolean) => {
    const { error } = await sb!.from("sites").update({ ai_track: on, ai_next_run_at: on ? new Date().toISOString() : null }).eq("id", siteId);
    setMsg(error ? error.message : on ? "Weekly tracking is on. The first check runs within a minute or two." : "Weekly tracking is off.");
    void load();
  };

  const addPrompt = async (text: string) => {
    const t = text.trim();
    if (t.length < 5 || t.length > 300) return setMsg("A prompt should be 5 to 300 characters.");
    const user = (await sb!.auth.getUser()).data.user;
    const { error } = await sb!.from("ai_prompts").insert({ site_id: siteId, user_id: user!.id, prompt: t });
    setMsg(error ? error.message : "");
    setNewPrompt("");
    void load();
  };

  const suggest = async () => {
    const name = site?.brand_terms[0] || site?.host.split(".")[0] || "";
    const cat = category.trim();
    const base = [`What is ${name}?`, `Is ${name} a good choice? What do people say about it?`, `What are the best alternatives to ${name}?`];
    const byCat = cat ? [`Who are the best ${cat}?`, `Which ${cat} would you recommend and why?`, `What should I look for when choosing ${cat}?`] : [];
    const have = new Set(prompts.map((p) => p.prompt.toLowerCase()));
    const user = (await sb!.auth.getUser()).data.user;
    const rows = [...base, ...byCat].filter((t) => !have.has(t.toLowerCase())).map((prompt) => ({ site_id: siteId, user_id: user!.id, prompt }));
    if (rows.length) await sb!.from("ai_prompts").insert(rows);
    setMsg(rows.length ? `Added ${rows.length} suggested prompts.` : "Those prompts are already there.");
    void load();
  };

  const removePrompt = async (id: string) => {
    await sb!.from("ai_prompts").delete().eq("id", id);
    void load();
  };

  const runAll = async () => {
    if (!prompts.length) return setMsg("Add at least one prompt first.");
    setBusy("run");
    setMsg("");
    try {
      const token = (await sb!.auth.getSession()).data.session?.access_token;
      for (let i = 0; i < prompts.length; i++) {
        setBusy(`Asking question ${i + 1} of ${prompts.length}…`);
        const r = await fetch("/api/ai/run", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ siteId, promptId: prompts[i].id }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Run failed.");
        await load();
      }
      setMsg("Done. Results below are from this run.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setBusy("");
    }
  };

  if (!sb) return <div className="panel auth-card"><h1>Accounts aren’t switched on yet</h1><p className="panel-note">Add your Supabase keys to enable AI visibility. See DEPLOY.md.</p></div>;
  if (signedIn === undefined) return <p className="dash-loading" role="status">Loading…</p>;
  if (!signedIn) return <div className="panel auth-card"><h1>Sign in to track AI visibility</h1><Link className="btn" href="/login">Sign in</Link></div>;
  if (!site) return <div className="panel auth-card"><h1>Site not found</h1><p className="panel-note">It may belong to another account. <Link className="fnd-link" href="/account">Back to your sites</Link></p></div>;

  return (
    <div className="acct-grid">
      <header className="acct-head">
        <div>
          <h1>AI visibility: {site.host}</h1>
          <p className="panel-note">Does ChatGPT name and cite this site when people ask about it? <Link className="fnd-link" href="/account">Back to your sites</Link></p>
        </div>
        <button type="button" className="btn sm" onClick={runAll} disabled={!!busy || providers.length === 0}>{busy ? (busy === "run" ? "Starting…" : busy) : "Run check now"}</button>
      </header>
      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>

      {providers.length === 0 && (
        <div className="panel"><h2>ChatGPT isn’t connected</h2><p className="panel-note">Set OPENAI_API_KEY as a server secret to run checks. See DEPLOY.md.</p></div>
      )}

      <section className="vis-tiles" aria-label="Summary">
        <div className="vt big"><b>{score ?? "–"}{score !== null && "%"}</b><span>Mentioned in answers</span></div>
        <div className="vt"><b>{citedPct ?? "–"}{citedPct !== null && "%"}</b><span>Cited with a link</span></div>
        <div className="vt"><b>{avgPos ?? "–"}</b><span>Average position when named</span></div>
        <div className="vt trend"><Trend points={trend} /><span>{trend.length > 1 ? "Over time" : "Run more checks to see a trend"}</span></div>
      </section>

      <section className="panel" aria-label="Questions to ask">
        <h2>Questions people ask</h2>
        {prompts.length === 0 ? <p className="panel-note">No questions yet. Add your own, or generate suggestions below.</p> : (
          <ul className="vis-prompts">
            {prompts.map((p) => (
              <li key={p.id}>
                <details>
                  <summary>
                    <span className="vp-q">{p.prompt}</span>
                    <span className="vp-cells">
                      {cols.map((c) => {
                        const r = latest.get(`${p.id}:${c.id}`);
                        const state = !r ? "na" : r.error ? "err" : r.mentioned ? (r.cited ? "cited" : "yes") : "no";
                        const text = { na: "Not run", err: "Error", cited: "Named and cited", yes: "Named", no: "Not named" }[state];
                        return <span key={c.id} className={`vc vc-${state}`} title={`${c.label}: ${text}`}><i>{c.label}</i>{text}</span>;
                      })}
                    </span>
                  </summary>
                  <div className="vp-body">
                    {cols.map((c) => {
                      const r = latest.get(`${p.id}:${c.id}`);
                      if (!r) return null;
                      return (
                        <div key={c.id} className="vp-ans">
                          <h3>{c.label} <small>{new Date(r.at).toLocaleDateString("en-GB", { dateStyle: "medium" })}</small></h3>
                          {r.error ? <p className="lm-err">{r.error}</p> : <p>{(r.answer ?? "").slice(0, 700)}{(r.answer ?? "").length > 700 ? "…" : ""}</p>}
                          {r.citations.length > 0 && <p className="vp-src">Sources: {r.citations.slice(0, 5).map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">{u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}</a>)}</p>}
                        </div>
                      );
                    })}
                    <button type="button" className="fnd-link" onClick={() => removePrompt(p.id)}>Remove this question</button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <form className="acct-add" onSubmit={(e) => { e.preventDefault(); void addPrompt(newPrompt); }}>
          <label className="sr-only" htmlFor="v-new">New question</label>
          <input id="v-new" className="fnd-search" placeholder="e.g. Who are the best plumbers in Pune?" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} maxLength={300} />
          <button className="btn sm" type="submit">Add</button>
        </form>
        <div className="acct-add">
          <label className="sr-only" htmlFor="v-cat">What you offer, and where</label>
          <input id="v-cat" className="fnd-search" placeholder="What you offer, e.g. emergency plumbers in Pune" value={category} onChange={(e) => setCategory(e.target.value)} />
          <button className="dash-btn" type="button" onClick={suggest}>Suggest questions</button>
        </div>
      </section>

      {voice.total > 0 && (
        <section className="panel" aria-label="Share of voice">
          <h2>Who ChatGPT names</h2>
          <p className="panel-note">Of {voice.total} answers, how many named each business.</p>
          <ul className="sov">
            {voice.rows.map((r) => (
              <li key={r.name} className={r.you ? "you" : ""}>
                <span>{r.name}{r.you && " (you)"}</span>
                <span className="sov-bar"><i style={{ width: `${(r.n / voice.max) * 100}%` }} /></span>
                <b>{r.n}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel" aria-label="Settings">
        <h2>Names and tracking</h2>
        <div className="tf"><label htmlFor="v-terms">Other names for your business</label><input id="v-terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Acme Plumbing, Acme" /><small>Comma separated. We always look for your domain too.</small></div>
        <div className="tf"><label htmlFor="v-comps">Competitors to compare against</label><input id="v-comps" value={comps} onChange={(e) => setComps(e.target.value)} placeholder="PipePro, FixIt Fast" /></div>
        <div className="brand-act"><button type="button" className="dash-btn primary" onClick={saveSettings}>Save names</button></div>
        <label className="as-f check"><input type="checkbox" checked={site.ai_track} onChange={(e) => toggleTrack(e.target.checked)} />Check automatically every week</label>
      </section>

      <p className="panel-note vis-limits">ChatGPT’s answers vary by wording, location and time, and these checks use the OpenAI API, which can differ from the ChatGPT app. Treat results as samples and look at trends, not single runs. A failed call is shown as an error and never counted as “not named”.</p>
    </div>
  );
}
