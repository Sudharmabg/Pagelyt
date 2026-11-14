"use client";

import { toast } from "../toast";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { BrandEditor } from "../account/brand/brand-editor";
import { ShareReport } from "./share-report";
import { AreaIcon, type IconKey } from "./icons";

type Tab = "share" | "brand" | "sample";
const TABS: { id: Tab; label: string; icon: IconKey; text: string }[] = [
  { id: "share", label: "Share report", icon: "share", text: "Send this report by link or email" },
  { id: "brand", label: "Brand settings", icon: "tools", text: "Logo, colour and contact details" },
  { id: "sample", label: "Sample report", icon: "overview", text: "What your client will see" },
];

/* The dashboard's Brand & share section: three sub-tabs, so brand settings and the sample report open
   right here instead of sending the owner off the dashboard. The tab is kept in the address (?tab=). */
export function BrandShare({ scanId, host, score, canEmail, owner }: { scanId: string; host: string; score: number; canEmail: boolean; owner: boolean }) {
  const asked = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(asked === "brand" || asked === "sample" ? asked : "share");
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ share: null, brand: null, sample: null });

  const pick = (t: Tab, focus = false) => {
    setTab(t);
    const u = new URL(window.location.href);
    if (t === "share") u.searchParams.delete("tab");
    else u.searchParams.set("tab", t);
    window.history.replaceState(window.history.state, "", u);
    if (focus) refs.current[t]?.focus();
  };

  return (
    <div className="bs">
      <div className="bs-tabs" role="tablist" aria-label="Brand and share">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            id={`bs-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="bs-panel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => pick(t.id)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              pick(TABS[(i + d + TABS.length) % TABS.length].id, true);
            }}
          >
            <span className="bs-ico"><AreaIcon k={t.icon} size={18} /></span>
            <span className="bs-txt"><b>{t.label}</b><small>{t.text}</small></span>
          </button>
        ))}
      </div>

      <div id="bs-panel" role="tabpanel" aria-labelledby={`bs-tab-${tab}`} className="bs-panel" key={tab}>
        {tab === "share" && <ShareTab scanId={scanId} host={host} score={score} canEmail={canEmail} owner={owner} onBrand={() => pick("brand")} onSample={() => pick("sample")} />}
        {tab === "brand" && (
          <div className="bs-brand">
            <BrandEditor embedded />
            <div className="bs-next">
              <span>Happy with it?</span>
              <button type="button" className="dash-btn" onClick={() => pick("sample")}>Preview the sample report →</button>
              <button type="button" className="dash-btn primary" onClick={() => pick("share")}>Share this report →</button>
            </div>
          </div>
        )}
        {tab === "sample" && <Sample onBrand={() => pick("brand")} onShare={() => pick("share")} />}
      </div>
    </div>
  );
}

/* The public sample report in a frame, wearing the owner's first saved brand when there is one. */
function Sample({ onBrand, onShare }: { onBrand: () => void; onShare: () => void }) {
  // undefined while loading; null when there is no saved brand (or no accounts here).
  const [brand, setBrand] = useState<{ name: string; color: string } | null | undefined>(() => (supabaseBrowser() ? undefined : null));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let live = true;
    sb.from("brands").select("name,color").order("created_at").limit(1)
      .then(({ data }) => live && setBrand(((data as { name: string; color: string }[] | null) ?? [])[0] ?? null), () => live && setBrand(null));
    return () => { live = false; };
  }, []);

  const q = new URLSearchParams();
  if (brand) {
    q.set("brand", brand.name);
    q.set("color", brand.color);
  }
  const src = `/r/demo${q.size ? `?${q}` : ""}`;

  return (
    <div className="panel bs-sample">
      <div className="bs-sample-head">
        <p>
          {brand ? <>Sample data, shown with your <b>{brand.name}</b> brand.</> : brand === null ? <>Sample data with a placeholder brand. <button type="button" className="fnd-link" onClick={onBrand}>Set up your brand</button> to see it with yours.</> : "Loading your brand…"}
        </p>
        <div className="sec-row">
          <Link className="dash-btn" href={src} target="_blank" rel="noopener">Open full page ↗</Link>
          <button type="button" className="dash-btn primary" onClick={onShare}>Share this report →</button>
        </div>
      </div>
      {brand !== undefined && (
        <div className={`bs-frame${loaded ? " in" : ""}`}>
          {!loaded && <span className="bs-skel" aria-hidden="true" />}
          <iframe title="Sample white-label report" src={src} loading="lazy" onLoad={() => setLoaded(true)} />
        </div>
      )}
    </div>
  );
}

type Link_ = { token: string; created_at: string; revoked: boolean; expires_at: string | null };
type BrandRow = { name: string; color: string; logo_url: string | null };
const HEX = /^#[0-9a-fA-F]{6}$/;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/* Share report tab: the share button with how it works, a live preview of the brand the client will see, and the
   links already made for this report (copy or withdraw each one). */
function ShareTab({ scanId, host, score, canEmail, owner, onBrand, onSample }: { scanId: string; host: string; score: number; canEmail: boolean; owner: boolean; onBrand: () => void; onSample: () => void }) {
  const [brand, setBrand] = useState<BrandRow | null | undefined>(() => (supabaseBrowser() ? undefined : null));
  const [links, setLinks] = useState<Link_[]>([]);
  const [copied, setCopied] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let live = true;
    sb.from("brands").select("name,color,logo_url").order("created_at").limit(1)
      .then(({ data }) => live && setBrand(((data as BrandRow[] | null) ?? [])[0] ?? null), () => live && setBrand(null));
    if (owner)
      sb.from("shared_reports").select("token,created_at,revoked,expires_at").eq("scan_id", scanId).order("created_at", { ascending: false }).limit(10)
        .then(({ data }) => live && setLinks((data as Link_[] | null) ?? []));
    return () => { live = false; };
  }, [scanId, owner, tick]);

  const url = (t: string) => `${window.location.origin}/r/${t}`;
  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(url(t));
      setCopied(t);
      toast("Share link copied");
      window.setTimeout(() => setCopied(""), 1800);
    } catch { /* the link is still on screen to copy by hand */ }
  };
  const withdraw = async (t: string) => {
    const { error } = (await supabaseBrowser()?.from("shared_reports").update({ revoked: true }).eq("token", t)) ?? {};
    if (!error) setLinks((x) => x.map((l) => (l.token === t ? { ...l, revoked: true } : l)));
  };
  const color = brand && HEX.test(brand.color) ? brand.color : "#14202b";
  const expired = (l: Link_) => !!l.expires_at && new Date(l.expires_at) < new Date();

  return (
    <div className="bs-share">
      <div className="panel bs-share-main">
        <h3>Send {host} to your client</h3>
        <ol className="bs-how">
          <li><b>Pick a brand</b><small>Your logo, colour and contact details. Nothing of Pagelyt.</small></li>
          <li><b>Choose what to include</b><small>How-to-fix steps, AI visibility, and when the link expires.</small></li>
          <li><b>Send it</b><small>Copy the link, or email it to your client with a note.</small></li>
        </ol>
        <div className="sec-row">
          {owner && <ShareReport scanId={scanId} host={host} score={score} canEmail={canEmail} onMade={() => setTick((n) => n + 1)} />}
          <button type="button" className="dash-btn" onClick={onSample}>See a sample</button>
        </div>
      </div>

      <figure className="panel bs-live" aria-label="Preview of your brand">
        <div className="brand-preview" style={{ ["--brand" as string]: color }}>
          <div className="bp-head">
            {brand?.logo_url?.startsWith("https://") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt="" height={28} />
            ) : (
              <b>{brand?.name || "Your brand"}</b>
            )}
            <span className="bp-btn">Download PDF</span>
          </div>
          <div className="bp-body">
            <small>Website report</small>
            <strong>{host}</strong>
            <p className="sm-score"><b>{score}</b> / 100</p>
            <div className="bp-bar"><i style={{ width: `${Math.max(4, Math.min(100, score))}%` }} /></div>
          </div>
        </div>
        <figcaption>
          {brand ? <>Shown with your <b>{brand.name}</b> brand. </> : brand === null ? "No brand yet. " : "Loading your brand… "}
          <button type="button" className="fnd-link" onClick={onBrand}>{brand ? "Edit brand" : "Set up your brand"}</button>
        </figcaption>
      </figure>

      {owner && links.length > 0 && (
        <div className="panel bs-links">
          <h3>Links you&rsquo;ve shared for this report</h3>
          <ul>
            {links.map((l) => {
              const off = l.revoked || expired(l);
              return (
                <li key={l.token} className={off ? "off" : ""}>
                  <span className="bs-l-main">
                    <code>/r/{l.token.slice(0, 10)}…</code>
                    <small>Made {day(l.created_at)} · {l.revoked ? "Withdrawn" : expired(l) ? "Expired" : l.expires_at ? `Expires ${day(l.expires_at)}` : "Never expires"}</small>
                  </span>
                  {!off && (
                    <span className="bs-l-act">
                      <a className="dash-btn" href={url(l.token)} target="_blank" rel="noopener noreferrer">Open</a>
                      <button type="button" className="dash-btn" onClick={() => void copy(l.token)}>{copied === l.token ? "Copied" : "Copy"}</button>
                      <button type="button" className="fnd-link" onClick={() => void withdraw(l.token)}>Withdraw</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
