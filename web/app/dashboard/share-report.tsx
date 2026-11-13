"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ModalX, onBackdrop } from "../modal-close";

type Brand = { id: string; name: string; logo_url: string | null; color: string; footer: string | null };
type Made = { link: string; sentTo: string | null; mailFailed: boolean };

const NOTE_MAX = 500;
const HEX = /^#[0-9a-fA-F]{6}$/;

/* "Share branded report": a modal that creates a client-facing link with your brand and none of ours,
   with a preview of the branded cover and (when emails are on) an optional email to the client.
   Only the signed-in owner sees it. The last link stays on screen until "Make another". */
export function ShareReport({ scanId, host, score, canEmail, onMade }: { scanId: string; host: string; score: number; canEmail: boolean; onMade?: () => void }) {
  const sb = supabaseBrowser();
  const ref = useRef<HTMLDialogElement>(null);
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState("");
  const [details, setDetails] = useState(true);
  const [ai, setAi] = useState(false);
  const [days, setDays] = useState("0");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sb) return;
    const load = async () => {
      const { data } = await sb.from("brands").select("id,name,logo_url,color,footer").order("created_at");
      setBrands((data as Brand[] | null) ?? []);
      setBrandId((cur) => cur || data?.[0]?.id || "");
    };
    sb.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      if (data.session) void load();
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSignedIn(!!s);
      if (s) void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  if (!sb || !signedIn) return null;

  const brand = brands.find((b) => b.id === brandId) ?? null;
  const color = brand && HEX.test(brand.color) ? brand.color : "#14202b";
  const sending = canEmail && email.trim() !== "";

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const token = (await sb.auth.getSession()).data.session?.access_token;
      const r = await fetch("/api/share", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          scanId,
          brandId: brandId || null,
          showDetails: details,
          includeAi: ai,
          expiresInDays: Number(days) || undefined,
          ...(sending ? { email: email.trim(), note: note.trim() } : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not create the link.");
      setMade({ link: `${window.location.origin}${j.path}`, sentTo: j.sentTo ?? null, mailFailed: sending && !j.emailed });
      onMade?.();
      setCopied(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the link.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!made) return;
    try {
      await navigator.clipboard.writeText(made.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the link is selectable */
    }
  };

  const again = () => {
    setMade(null);
    setEmail("");
    setNote("");
    setErr("");
  };

  return (
    <>
      <button type="button" className="dash-btn primary" onClick={() => ref.current?.showModal()} aria-haspopup="dialog">Share branded report</button>
      <dialog
        ref={ref}
        className="lead-modal share-modal"
        aria-labelledby="share-h"
        onClick={(e) => onBackdrop(e, () => ref.current?.close())}
      >
        <div className="lm-body">
          <div className="sm-top">
            <h2 id="share-h">Share branded report</h2>
            <ModalX onClick={() => ref.current?.close()} />
          </div>

          <div className="sm-grid">
            {made ? (
              <div className="sm-done" role="status">
                {made.sentTo && <p className="sm-sent">Sent to <strong>{made.sentTo}</strong>.</p>}
                {made.mailFailed && <p className="lm-err">The link is ready, but the email didn&rsquo;t go out. Copy the link and send it yourself.</p>}
                <label>
                  Your client-facing link
                  <input readOnly value={made.link} onFocus={(e) => e.currentTarget.select()} />
                </label>
                <div className="lm-act">
                  <a className="btn ghost" href={made.link} target="_blank" rel="noopener noreferrer">Open</a>
                  <button type="button" className="btn" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
                </div>
                <p className="lm-fine">
                  Links stay listed under <Link href="/account/brand">Account → Brand</Link>, where you can withdraw them.{" "}
                  <button type="button" className="lm-link" onClick={again}>Make another</button>
                </p>
              </div>
            ) : (
              <form className="sm-form" onSubmit={create} noValidate>
                {brands.length === 0 ? (
                  <p className="lm-fine sm-nobrand">No brand yet. <Link href="/account/brand">Create one</Link> to put your logo and colour on the report.</p>
                ) : (
                  <label>
                    Brand
                    <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      <option value="">No brand (neutral)</option>
                    </select>
                  </label>
                )}
                <label className="sm-check"><input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} />Include &ldquo;how to fix&rdquo; steps</label>
                <label className="sm-check"><input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} />Include AI visibility summary</label>
                <label>
                  Link expires
                  <select value={days} onChange={(e) => setDays(e.target.value)}>
                    <option value="0">Never</option>
                    <option value="7">In 7 days</option>
                    <option value="30">In 30 days</option>
                    <option value="90">In 90 days</option>
                  </select>
                </label>
                {canEmail && (
                  <>
                    <label>
                      <span>Email it to your client <small className="sm-opt">optional</small></span>
                      <input type="email" inputMode="email" autoComplete="off" maxLength={254} placeholder="client@theirsite.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    {sending && (
                      <label>
                        <span>Note <small className="sm-opt">{note.length}/{NOTE_MAX}</small></span>
                        <textarea rows={3} maxLength={NOTE_MAX} placeholder="Hi, here's the report we discussed." value={note} onChange={(e) => setNote(e.target.value)} />
                      </label>
                    )}
                  </>
                )}
                {err && <p className="lm-err" role="alert">{err}</p>}
                <button type="submit" className="btn" disabled={busy}>{busy ? (sending ? "Sending…" : "Creating…") : sending ? "Create & send" : "Create link"}</button>
              </form>
            )}

            <figure className="sm-preview" aria-label="Preview of the shared report">
              <div className="brand-preview" style={{ ["--brand" as string]: color }}>
                <div className="bp-head">
                  {brand?.logo_url?.startsWith("https://") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo_url} alt="" height={32} />
                  ) : (
                    <b>{brand?.name || "Website report"}</b>
                  )}
                  <span className="bp-btn">Download PDF</span>
                </div>
                <div className="bp-body">
                  <small>Website report</small>
                  <strong className="sm-host">{host}</strong>
                  <p className="sm-score"><b>{score}</b> / 100</p>
                  <div className="bp-bar"><i style={{ width: `${Math.max(4, Math.min(100, score))}%` }} /></div>
                  <p>{brand?.footer || (brand ? "" : "A neutral report, with no logo or brand colour.")}</p>
                </div>
              </div>
              <figcaption className="lm-fine">What your client sees</figcaption>
            </figure>
          </div>
        </div>
      </dialog>
    </>
  );
}
