"use client";

import { useEffect, useRef, useState } from "react";

export type LeadInput = { name: string; email: string; phone: string };

/* Asks for contact details before the scan runs. `onSubmit` resolves to an error message, or null on success
   (the parent then navigates away, so the modal just keeps showing progress). */
export function LeadModal({
  open,
  host,
  steps,
  step,
  running = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  host: string;
  steps: string[];
  step: number;
  /** True when the parent is already scanning (signed-in visitors skip the form). */
  running?: boolean;
  onClose: () => void;
  onSubmit: (lead: LeadInput, turnstile?: string) => Promise<string | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busyLocal, setBusy] = useState(false);
  const busy = busyLocal || running;
  const [err, setErr] = useState("");
  const tsRef = useRef<HTMLDivElement>(null);
  const token = useRef<string | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Cloudflare Turnstile (human check). Only loaded when a site key is configured.
  useEffect(() => {
    if (!open || !siteKey || !tsRef.current) return;
    const mount = () => {
      const w = window as unknown as { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => void } };
      if (w.turnstile && tsRef.current && !tsRef.current.hasChildNodes()) {
        w.turnstile.render(tsRef.current, { sitekey: siteKey, callback: (t: string) => { token.current = t; } });
      }
    };
    if (document.getElementById("cf-turnstile-js")) return mount();
    const sc = document.createElement("script");
    sc.id = "cf-turnstile-js";
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    sc.async = true;
    sc.onload = mount;
    document.head.append(sc);
  }, [open, siteKey]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const lead = {
      name: String(f.get("name") || "").trim(),
      email: String(f.get("email") || "").trim(),
      phone: String(f.get("phone") || "").trim(),
    };
    if (lead.name.length < 2) return setErr("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return setErr("Please enter a valid email address.");
    const digits = lead.phone.replace(/\D/g, "");
    if (!/^[\d\s()+.-]+$/.test(lead.phone) || digits.length < 7 || digits.length > 15) return setErr("Please enter a valid phone number.");
    setErr("");
    setBusy(true);
    const problem = await onSubmit(lead, token.current);
    if (problem) {
      setErr(problem);
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="lead-modal"
      aria-labelledby="lead-h"
      onClose={onClose}
      onCancel={(e) => busy && e.preventDefault()}
    >
      <form onSubmit={submit} noValidate>
        <h2 id="lead-h">{busy ? `Analysing ${host}…` : "Where should we send your report?"}</h2>
        {busy ? (
          <div className="lm-progress" role="status" aria-live="polite">
            <div className="lm-bar" aria-hidden="true"><i style={{ width: `${Math.min(96, ((step + 1) / steps.length) * 100)}%` }} /></div>
            <ol className="lm-steps">
              {steps.map((t, i) => (
                <li key={t} className={i < step ? "done" : i === step ? "now" : ""}>
                  <span className="lm-mark" aria-hidden="true">{i < step ? "✓" : ""}</span>
                  {t}
                </li>
              ))}
            </ol>
            <small>This takes 10 to 30 seconds. Your dashboard opens automatically.</small>
          </div>
        ) : (
          <>
            <p className="lm-sub">
              Tell us who to send the full report for <strong>{host}</strong> to. Your dashboard opens right after.
            </p>
            <label>
              Full name
              <input name="name" type="text" autoComplete="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" inputMode="email" required />
            </label>
            <label>
              Phone number
              <input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" required />
            </label>
            {err && (
              <p className="lm-err" role="alert">
                {err}
              </p>
            )}
            {siteKey && <div ref={tsRef} className="lm-ts" />}
            <p className="lm-fine">We use your details to deliver the report and follow up about Pagelyt. No spam.</p>
            <div className="lm-act">
              <button type="button" className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn">
                Get my report
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
