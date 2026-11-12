"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Brand = { id: string; name: string; logo_url: string | null; color: string; website: string | null; contact_email: string | null; footer: string | null; show_powered_by: boolean };
type Share = { token: string; created_at: string; revoked: boolean; expires_at: string | null; scans: { host: string } | null };

const EMPTY = { name: "", logo_url: "", color: "#6a30bd", website: "", contact_email: "", footer: "", show_powered_by: false };
type Form = typeof EMPTY;

function validate(f: Form): string {
  if (f.name.trim().length < 1 || f.name.length > 80) return "Enter your agency or brand name (up to 80 characters).";
  if (f.logo_url && !/^https:\/\/\S+$/.test(f.logo_url)) return "The logo must be an https:// image address.";
  if (!/^#[0-9a-fA-F]{6}$/.test(f.color)) return "Pick a valid colour.";
  if (f.website && !/^https?:\/\/\S+$/.test(f.website)) return "The website must start with http:// or https://.";
  if (f.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.contact_email)) return "Enter a valid contact email.";
  if (f.footer.length > 300) return "The footer note can be up to 300 characters.";
  return "";
}

/** `embedded`: shown inside the dashboard's Brand & share section, so no page heading or back link. */
export function BrandEditor({ embedded = false }: { embedded?: boolean }) {
  const sb = supabaseBrowser();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!sb) return;
    const [b, s] = await Promise.all([
      sb.from("brands").select("id,name,logo_url,color,website,contact_email,footer,show_powered_by").order("created_at"),
      sb.from("shared_reports").select("token,created_at,revoked,expires_at,scans(host)").order("created_at", { ascending: false }).limit(30),
    ]);
    setBrands((b.data as Brand[]) ?? []);
    setShares((s.data as unknown as Share[]) ?? []);
  }, [sb]);

  useEffect(() => {
    if (!sb) return;
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

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate(form);
    if (problem) return setMsg(problem);
    const user = (await sb!.auth.getUser()).data.user;
    if (!user) return setMsg("Please sign in again.");
    const row = { name: form.name.trim(), logo_url: form.logo_url.trim() || null, color: form.color, website: form.website.trim() || null, contact_email: form.contact_email.trim() || null, footer: form.footer.trim() || null, show_powered_by: form.show_powered_by };
    const { error } = editing ? await sb!.from("brands").update(row).eq("id", editing) : await sb!.from("brands").insert({ ...row, user_id: user.id });
    setMsg(error ? error.message : "Brand saved.");
    if (!error) {
      setForm(EMPTY);
      setEditing(null);
      void load();
    }
  };

  const edit = (b: Brand) => {
    setEditing(b.id);
    setForm({ name: b.name, logo_url: b.logo_url ?? "", color: b.color, website: b.website ?? "", contact_email: b.contact_email ?? "", footer: b.footer ?? "", show_powered_by: b.show_powered_by });
  };

  const remove = async (id: string) => {
    const { error } = await sb!.from("brands").delete().eq("id", id);
    setMsg(error ? error.message : "Brand deleted. Existing links fall back to a neutral style.");
    void load();
  };

  const revoke = async (token: string) => {
    const { error } = await sb!.from("shared_reports").update({ revoked: true }).eq("token", token);
    setMsg(error ? error.message : "Link withdrawn.");
    void load();
  };

  if (!sb) return <div className="panel auth-card"><h1>Accounts aren’t switched on yet</h1><p className="panel-note">Add your Supabase keys to enable brand settings. See DEPLOY.md.</p></div>;
  if (signedIn === undefined) return <p className="dash-loading" role="status">Loading…</p>;
  if (!signedIn) return <div className="panel auth-card"><h1>Sign in to set up your brand</h1><Link className="btn" href="/login">Sign in</Link></div>;

  return (
    <div className="acct-grid">
      {!embedded && (
        <header className="acct-head">
          <div>
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/dashboard">Dashboard</Link> <span aria-hidden="true">/</span> <Link href="/account">Account</Link> <span aria-hidden="true">/</span> <span aria-current="page">Brand settings</span>
            </nav>
            <h1>Brand settings</h1>
            <p className="panel-note">White-label reports show your brand to your clients, with no Pagelyt navigation.</p>
            <div className="sec-row">
              <Link className="dash-btn" href="/dashboard"><span aria-hidden="true">←</span>&nbsp;Back to dashboard</Link>
              <Link className="dash-btn" href="/r/demo" target="_blank">See a sample report</Link>
            </div>
          </div>
        </header>
      )}
      <p className="acct-msg" role="status" aria-live="polite">{msg}</p>

      <section className="panel" aria-label={editing ? "Edit brand" : "New brand"}>
        <h2>{editing ? "Edit brand" : "New brand"}</h2>
        <div className="brand-grid">
          <form onSubmit={save} className="brand-form" noValidate>
            <div className="tf"><label htmlFor="b-name">Brand or agency name</label><input id="b-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} /></div>
            <div className="tf"><label htmlFor="b-logo">Logo address</label><input id="b-logo" placeholder="https://youragency.com/logo.png" value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} /><small>An https:// image link. Wide logos on a transparent or white background work best.</small></div>
            <div className="tf"><label htmlFor="b-color">Brand colour</label><div className="color-row"><input id="b-color" type="color" value={form.color} onChange={(e) => set("color", e.target.value)} /><code>{form.color}</code></div></div>
            <div className="tf"><label htmlFor="b-web">Website</label><input id="b-web" placeholder="https://youragency.com" value={form.website} onChange={(e) => set("website", e.target.value)} /></div>
            <div className="tf"><label htmlFor="b-mail">Contact email</label><input id="b-mail" type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} /></div>
            <div className="tf"><label htmlFor="b-foot">Footer note</label><textarea id="b-foot" rows={2} value={form.footer} onChange={(e) => set("footer", e.target.value)} maxLength={300} /></div>
            <label className="as-f check"><input type="checkbox" checked={form.show_powered_by} onChange={(e) => set("show_powered_by", e.target.checked)} />Show “Powered by Pagelyt” in the footer</label>
            <div className="brand-act">
              <button className="btn sm" type="submit">{editing ? "Save changes" : "Create brand"}</button>
              {editing && <button type="button" className="dash-btn" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</button>}
            </div>
          </form>

          <div className="brand-preview" style={{ ["--brand" as string]: /^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : "#14202b" }} aria-label="Preview">
            <div className="bp-head">
              {form.logo_url.startsWith("https://") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo_url} alt="" height={32} />
              ) : (
                <b>{form.name || "Your brand"}</b>
              )}
              <span className="bp-btn">Download PDF</span>
            </div>
            <div className="bp-body">
              <small>Website report</small>
              <strong>client-site.com</strong>
              <div className="bp-bar"><i /></div>
              <p>{form.footer || "Your footer note appears here."}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel" aria-label="Your brands">
        <h2>Your brands</h2>
        {brands.length === 0 ? <p className="panel-note">No brands yet. Create one above, then share a report from any dashboard.</p> : (
          <ul className="acct-sites">
            {brands.map((b) => (
              <li key={b.id}>
                <span className="swatch" style={{ background: b.color }} aria-hidden="true" />
                <div className="as-main"><strong>{b.name}</strong><span className="panel-note">{b.website ?? "No website set"}</span></div>
                <button type="button" className="dash-btn" onClick={() => edit(b)}>Edit</button>
                <button type="button" className="dash-btn" onClick={() => remove(b.id)} aria-label={`Delete ${b.name}`}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-label="Shared links">
        <h2>Shared report links</h2>
        {shares.length === 0 ? <p className="panel-note">Links you create from a dashboard (Share branded report) appear here, so you can withdraw them.</p> : (
          <ul className="acct-scans">
            {shares.map((s) => (
              <li key={s.token}>
                {s.revoked ? <span>{s.scans?.host ?? "Report"} (withdrawn)</span> : <Link href={`/r/${s.token}`} target="_blank">{s.scans?.host ?? "Report"}</Link>}
                <span>{new Date(s.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span>
                {s.revoked ? <b>Off</b> : <button type="button" className="fnd-link" onClick={() => revoke(s.token)}>Withdraw</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
