"use client";

import { PageLoader } from "@/app/page-loader";
import Link from "next/link";
import { Check, Hash, Link2, MessageSquareText, Play, Plus, RotateCw, Sparkles, TrendingUp, Users, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { visibilityScore } from "@/lib/ai/analyse";
import { PROVIDER } from "@/lib/ai/providers";
import { SignInLink } from "@/app/sign-in-modal";

type Site = { id: string; host: string; brand_terms: string[]; competitors: string[]; ai_track: boolean };
type Prompt = { id: string; prompt: string };
type Run = { id: number; prompt_id: string; provider: string; at: string; mentioned: boolean; cited: boolean; position: number | null; competitor_counts: Record<string, number>; answer: string | null; citations: string[]; error: string | null };
type Provider = { id: string; label: string };

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12);
const STEPS = ["Describe", "Pick", "Check"] as const;
type Pick = { q: string; on: boolean };

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

/** The AI visibility tool. On its own page (/account/visibility/<id>) it has a page title and a link back to the
    account; `embedded` is the same tool inside the report dashboard's AI visibility view. */
export function Visibility({ siteId, embedded }: { siteId: string; embedded?: boolean }) {
  const sb = supabaseBrowser();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [site, setSite] = useState<Site | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [providers, setProviders] = useState<Provider[] | null>(null); // null until we know whether ChatGPT is connected
  const [terms, setTerms] = useState("");
  const [comps, setComps] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(""); // the "Check all" label while a batch runs
  const [step, setStep] = useState<[number, number] | null>(null); // progress of a batch of checks
  const [running, setRunning] = useState<string[]>([]); // prompt ids being asked right now
  // The guided "add questions" flow: 1 describe what you offer, 2 pick from ChatGPT's suggestions (or write your own), 3 check them.
  const [adder, setAdder] = useState<0 | 1 | 2 | 3>(0); // 0 = closed
  const [offer, setOffer] = useState("");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [own, setOwn] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [addErr, setAddErr] = useState("");

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
    // One retry: the first request can fail while a dev server is still compiling the route.
    const ask = () => fetch("/api/ai/run").then((r) => r.json()).then((j) => setProviders(j.providers ?? []));
    ask().catch(() => window.setTimeout(() => void ask().catch(() => setProviders([])), 1500));
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

  useEffect(() => {
    try { setOffer(localStorage.getItem(`vis-offer:${siteId}`) ?? ""); } catch {}
  }, [siteId]);

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

  const token = async () => (await sb!.auth.getSession()).data.session?.access_token;

  /* Ask ChatGPT one question; the row shows its own spinner meanwhile. Returns false when the call failed. */
  const checkOne = async (id: string, tk?: string) => {
    setRunning((x) => [...x, id]);
    try {
      const r = await fetch("/api/ai/run", { method: "POST", headers: { authorization: `Bearer ${tk ?? (await token())}`, "content-type": "application/json" }, body: JSON.stringify({ siteId, promptId: id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Check failed.");
      await load();
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Check failed.");
      return false;
    } finally {
      setRunning((x) => x.filter((k) => k !== id));
    }
  };

  /* Ask several questions one after another, filling each row in as it finishes. */
  const checkMany = async (ids: string[]) => {
    if (!ids.length) return setMsg("Add at least one question first.");
    setMsg("");
    const tk = await token();
    for (let i = 0; i < ids.length; i++) {
      setBusy(`Asking ${i + 1} of ${ids.length}…`);
      setStep([i, ids.length]);
      if (!(await checkOne(ids[i], tk))) break;
      if (i === ids.length - 1) setMsg(`Done. ${ids.length === 1 ? "The result is" : "Results are"} below.`);
    }
    setBusy("");
    setStep(null);
  };

  const openAdder = () => {
    setAddErr("");
    setPicks([]);
    setAdded([]);
    setAdder(1);
  };

  /* Step 1 → 2: ChatGPT suggests questions for what the site offers. `more` adds to the list instead of replacing it. */
  const suggest = async (more = false) => {
    const what = offer.trim();
    if (what.length < 3) return setAddErr("Tell us what you offer, and where.");
    try { localStorage.setItem(`vis-offer:${siteId}`, what); } catch {}
    setThinking(true);
    setAddErr("");
    try {
      const r = await fetch("/api/ai/suggest", { method: "POST", headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" }, body: JSON.stringify({ siteId, offer: what }) });
      const j = (await r.json().catch(() => ({}))) as { questions?: string[]; error?: string };
      if (!r.ok || !j.questions) throw new Error(j.error || "Could not suggest questions.");
      setPicks((x) => {
        const base = more ? x : [];
        const have = new Set(base.map((p) => p.q.toLowerCase()));
        return [...base, ...j.questions!.filter((q) => !have.has(q.toLowerCase())).map((q) => ({ q, on: !more }))];
      });
      setAdder(2);
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : "Could not suggest questions.");
    } finally {
      setThinking(false);
    }
  };

  const addOwn = () => {
    const t = own.trim();
    if (t.length < 5 || t.length > 300) return setAddErr("A question should be 5 to 300 characters.");
    setAddErr("");
    setPicks((x) => (x.some((p) => p.q.toLowerCase() === t.toLowerCase()) ? x : [...x, { q: t, on: true }]));
    setOwn("");
  };

  /* Step 2 → 3: save the ticked questions. */
  const addPicked = async () => {
    const have = new Set(prompts.map((p) => p.prompt.toLowerCase()));
    const chosen = picks.filter((p) => p.on && !have.has(p.q.toLowerCase())).map((p) => p.q);
    if (!chosen.length) return setAddErr("Tick at least one question.");
    const user = (await sb!.auth.getUser()).data.user;
    const { data, error } = await sb!.from("ai_prompts").insert(chosen.map((prompt) => ({ site_id: siteId, user_id: user!.id, prompt }))).select("id");
    if (error) return setAddErr(error.message);
    setAdded(((data as { id: string }[] | null) ?? []).map((r) => r.id));
    setAddErr("");
    setAdder(3);
    void load();
  };

  const removePrompt = async (id: string) => {
    await sb!.from("ai_prompts").delete().eq("id", id);
    void load();
  };

  if (!sb) return <div className="panel auth-card"><h1>Accounts aren’t switched on yet</h1><p className="panel-note">Add your Supabase keys to enable AI visibility. See DEPLOY.md.</p></div>;
  if (signedIn === undefined) return <PageLoader text="Loading…" />;
  if (!signedIn) return <div className="panel auth-card"><h1>Sign in to track AI visibility</h1><SignInLink className="btn" stay>Sign in</SignInLink></div>;
  if (!site) return <div className="panel auth-card"><h1>Site not found</h1><p className="panel-note">It may belong to another account. <Link className="fnd-link" href="/account">Back to your sites</Link></p></div>;

  const lastRun = runs[0]?.at;

  return (
    <div className={`vis${embedded ? " embedded" : ""}`}>
      <header className="vis-head">
        <div>
          {!embedded && <h1>AI visibility: {site.host}</h1>}
          <p className="panel-note">
            Does ChatGPT name and cite {site.host} when people ask about what you offer?{" "}
            {!embedded && <Link className="fnd-link" href="/account">Back to your sites</Link>}
          </p>
        </div>
        <div className="vis-run">
          <button type="button" className="dash-btn primary" onClick={() => void checkMany(prompts.map((p) => p.id))} disabled={!!busy || running.length > 0 || !providers?.length || prompts.length === 0}>
            {busy || (prompts.length > 1 ? `Check all ${prompts.length} questions` : "Check now")}
          </button>
          <small>{lastRun ? `Last checked ${new Date(lastRun).toLocaleDateString("en-GB", { dateStyle: "medium" })}` : "Not checked yet"}{site.ai_track && " · weekly"}</small>
        </div>
        {step && (
          <div className="vis-progress" role="progressbar" aria-label="Checking questions" aria-valuemin={0} aria-valuemax={step[1]} aria-valuenow={step[0]}>
            <i style={{ width: `${(step[0] / step[1]) * 100}%` }} />
          </div>
        )}
      </header>
      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>

      {providers?.length === 0 && (
        <div className="panel"><h2>ChatGPT isn’t connected</h2><p className="panel-note">Set OPENAI_API_KEY as a server secret to run checks. See DEPLOY.md.</p></div>
      )}

      <section className="vis-tiles sg" aria-label="Summary">
        <div className="vt sg-tile" style={{ ["--i" as string]: 0 }}>
          <span className="sg-top"><span>Mentioned in answers</span><MessageSquareText aria-hidden="true" /></span>
          <b>{score ?? "–"}{score !== null && "%"}</b>
          <small>{okRuns.length ? `${okRuns.filter((r) => r.mentioned).length} of ${okRuns.length} answers` : "Run a check to see it"}</small>
        </div>
        <div className="vt sg-tile" style={{ ["--i" as string]: 1 }}>
          <span className="sg-top"><span>Cited with a link</span><Link2 aria-hidden="true" /></span>
          <b>{citedPct ?? "–"}{citedPct !== null && "%"}</b>
          <small>{okRuns.length ? "Answers linking to you" : "Links back to your site"}</small>
        </div>
        <div className="vt sg-tile" style={{ ["--i" as string]: 2 }}>
          <span className="sg-top"><span>Average position</span><Hash aria-hidden="true" /></span>
          <b>{avgPos ?? "–"}</b>
          <small>Where you&rsquo;re named in the list</small>
        </div>
        <div className="vt sg-tile trend" style={{ ["--i" as string]: 3 }}>
          <span className="sg-top"><span>Over time</span><TrendingUp aria-hidden="true" /></span>
          {trend.length > 1 ? <Trend points={trend} /> : <b>–</b>}
          <small>{trend.length > 1 ? `${trend.length} checks` : "Run more checks to see a trend"}</small>
        </div>
      </section>

      <div className="vis-layout">
        <section className="panel vis-main" aria-label="Questions to ask">
          <div className="vis-ph sc-head">
            <span className="sc-ic" aria-hidden="true"><MessageSquareText /></span>
            <div>
              <h2>Questions people ask</h2>
              <p className="panel-note">What your customers might type into ChatGPT.</p>
            </div>
            {prompts.length > 0 && adder === 0 ? (
              <button type="button" className="dash-btn vis-add-btn" onClick={openAdder}><Plus aria-hidden="true" />Add questions</button>
            ) : (
              <span className="vis-count">{prompts.length} question{prompts.length === 1 ? "" : "s"}</span>
            )}
          </div>

          {(adder > 0 || prompts.length === 0) && (
            <div className="vis-adder" role="group" aria-label="Add questions">
              <ol className="vis-steps">
                {STEPS.map((t, i) => {
                  const n = (adder || 1) as number;
                  return (
                    <li key={t} className={i + 1 < n ? "done" : i + 1 === n ? "now" : ""} aria-current={i + 1 === n ? "step" : undefined}>
                      <span className="vs-n">{i + 1 < n ? <Check aria-hidden="true" /> : i + 1}</span>
                      <span className="vs-t">{t}</span>
                    </li>
                  );
                })}
              </ol>
              {prompts.length > 0 && <button type="button" className="vis-adder-x" aria-label="Close" onClick={() => setAdder(0)}><X /></button>}

              {(adder || 1) === 1 && (
                <form className="vs-body" onSubmit={(e) => { e.preventDefault(); void suggest(); }}>
                  <label htmlFor="v-offer"><b>What do you offer, and where?</b><small>ChatGPT turns this into questions your customers might ask.</small></label>
                  <div className="vis-add">
                    <input id="v-offer" className="fnd-search" placeholder="e.g. emergency plumbers in Pune" value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={200} disabled={thinking} />
                    <button className="dash-btn primary" type="submit" disabled={thinking || offer.trim().length < 3 || !providers?.length}>
                      {thinking ? <><span className="live-spin" aria-hidden="true" />Thinking…</> : <><Sparkles aria-hidden="true" />Suggest questions</>}
                    </button>
                  </div>
                  <button type="button" className="fnd-link vs-skip" onClick={() => { setAddErr(""); setAdder(2); }}>Skip, I&rsquo;ll write my own</button>
                </form>
              )}

              {adder === 2 && (
                <div className="vs-body">
                  <p className="vs-lead"><b>Pick the questions to track</b><small>{picks.length ? `${picks.filter((p) => p.on).length} of ${picks.length} ticked.` : "Write the questions your customers might ask."}</small></p>
                  {picks.length > 0 && (
                    <ul className="vs-picks">
                      {picks.map((p, i) => (
                        <li key={p.q}>
                          <label className={p.on ? "on" : ""}>
                            <input type="checkbox" checked={p.on} onChange={(e) => setPicks((x) => x.map((y, k) => (k === i ? { ...y, on: e.target.checked } : y)))} />
                            <span className="vs-box" aria-hidden="true"><Check /></span>
                            <span>{p.q}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form className="vis-add" onSubmit={(e) => { e.preventDefault(); addOwn(); }}>
                    <label className="sr-only" htmlFor="v-own">Write your own question</label>
                    <input id="v-own" className="fnd-search" placeholder="Write your own, e.g. Who are the best plumbers in Pune?" value={own} onChange={(e) => setOwn(e.target.value)} maxLength={300} />
                    <button className="dash-btn" type="submit" disabled={own.trim().length < 5}><Plus aria-hidden="true" />Add</button>
                  </form>
                  <div className="vs-foot">
                    <button type="button" className="fnd-link" onClick={() => setAdder(1)}>← Back</button>
                    {offer.trim().length >= 3 && picks.length > 0 && (
                      <button type="button" className="fnd-link" onClick={() => void suggest(true)} disabled={thinking}>{thinking ? "Thinking…" : "More ideas"}</button>
                    )}
                    <button type="button" className="dash-btn primary" onClick={() => void addPicked()} disabled={!picks.some((p) => p.on)}>
                      Add {picks.filter((p) => p.on).length || ""} question{picks.filter((p) => p.on).length === 1 ? "" : "s"} →
                    </button>
                  </div>
                </div>
              )}

              {adder === 3 && (
                <div className="vs-body vs-done">
                  <p className="vs-lead"><b>{added.length} question{added.length === 1 ? "" : "s"} added</b><small>Ask ChatGPT now to see whether it names {site.host}. About 10 seconds each.</small></p>
                  <div className="vs-foot">
                    <button type="button" className="fnd-link" onClick={() => setAdder(0)}>Later</button>
                    <button type="button" className="dash-btn primary" disabled={!!busy || !providers?.length} onClick={() => { const ids = added; setAdder(0); void checkMany(ids); }}>
                      <Play aria-hidden="true" />Check {added.length === 1 ? "it" : `these ${added.length}`} now
                    </button>
                  </div>
                </div>
              )}
              {addErr && <p className="lm-err" role="alert">{addErr}</p>}
            </div>
          )}

          {prompts.length > 0 && (
            <ul className="vis-prompts">
              {prompts.map((p) => {
                const r = latest.get(`${p.id}:${PROVIDER.id}`);
                const asking = running.includes(p.id);
                const state = asking ? "run" : !r ? "na" : r.error ? "err" : r.mentioned ? (r.cited ? "cited" : "yes") : "no";
                const text = { run: "Asking…", na: "Not checked", err: "Error", cited: "Named and cited", yes: "Named", no: "Not named" }[state];
                return (
                  <li key={p.id} className={`vp vp-s-${state}`}>
                    <details>
                      <summary>
                        <span className="vp-q">{p.prompt}</span>
                        <span className="vp-cells">
                          <span className={`vc vc-${state}`} title={`${PROVIDER.label}: ${text}`}>{asking && <span className="live-spin" aria-hidden="true" />}{text}</span>
                        </span>
                      </summary>
                      <div className="vp-body">
                        {cols.map((c) => {
                          const rr = latest.get(`${p.id}:${c.id}`);
                          if (!rr) return <p key={c.id} className="panel-note">Not checked yet. Press Check to see ChatGPT’s answer.</p>;
                          return (
                            <div key={c.id} className="vp-ans">
                              <h3>{c.label}’s answer <small>{new Date(rr.at).toLocaleDateString("en-GB", { dateStyle: "medium" })}</small></h3>
                              {rr.error ? <p className="lm-err">{rr.error}</p> : <p>{(rr.answer ?? "").slice(0, 700)}{(rr.answer ?? "").length > 700 ? "…" : ""}</p>}
                              {rr.citations.length > 0 && <p className="vp-src">Sources: {rr.citations.slice(0, 5).map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">{u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}</a>)}</p>}
                            </div>
                          );
                        })}
                        <button type="button" className="fnd-link" onClick={() => removePrompt(p.id)}>Remove this question</button>
                      </div>
                    </details>
                    <button type="button" className="vp-run" onClick={() => void checkOne(p.id)} disabled={asking || !!busy || !providers?.length} aria-label={`${r ? "Check again" : "Check"}: ${p.prompt}`}>
                      {asking ? <span className="live-spin" aria-hidden="true" /> : r ? <RotateCw aria-hidden="true" /> : <Play aria-hidden="true" />}
                      <span>{r ? "Check again" : "Check"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="vis-side">
          <section className="panel" aria-label="Share of voice">
            <div className="sc-head"><span className="sc-ic" aria-hidden="true"><Users /></span><h2>Who ChatGPT names</h2></div>
            {voice.total > 0 ? (
              <>
                <p className="panel-note">Of {voice.total} answers, how many named each business.</p>
                <ul className="sov">
                  {voice.rows.map((r) => (
                    <li key={r.name} className={r.you ? "you" : ""}>
                      <span title={r.name}>{r.name}{r.you && " (you)"}</span>
                      <span className="sov-bar"><i style={{ width: `${(r.n / voice.max) * 100}%` }} /></span>
                      <b>{r.n}</b>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="panel-note">Run a check to see how often ChatGPT names you next to your competitors.</p>
            )}
          </section>

          <section className="panel" aria-label="Settings">
            <div className="sc-head"><span className="sc-ic" aria-hidden="true"><SlidersHorizontal /></span><h2>Names and tracking</h2></div>
            <div className="tf"><label htmlFor="v-terms">Other names for your business</label><input id="v-terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Acme Plumbing, Acme" /><small>Comma separated. We always look for your domain too.</small></div>
            <div className="tf"><label htmlFor="v-comps">Competitors to compare against</label><input id="v-comps" value={comps} onChange={(e) => setComps(e.target.value)} placeholder="PipePro, FixIt Fast" /></div>
            <div className="brand-act"><button type="button" className="dash-btn primary" onClick={saveSettings}>Save names</button></div>
            <label className="as-f check"><input type="checkbox" checked={site.ai_track} onChange={(e) => toggleTrack(e.target.checked)} />Check automatically every week</label>
          </section>
        </aside>
      </div>

      <p className="panel-note vis-limits">ChatGPT’s answers vary by wording, location and time, and these checks use the OpenAI API, which can differ from the ChatGPT app. Treat results as samples and look at trends, not single runs. A failed call is shown as an error and never counted as “not named”.</p>
    </div>
  );
}
