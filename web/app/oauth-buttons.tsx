"use client";

import { useState } from "react";
import { PROVIDER_NAMES, enabledProviders, startOAuth, type Provider } from "@/lib/oauth";

export const ICONS: Record<Provider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" />
    </svg>
  ),
};

/** "Continue with Google / GitHub" above an email form, with an "or" divider under it. Renders nothing until
    NEXT_PUBLIC_OAUTH_PROVIDERS switches providers on. Without `next` the person comes back to this page. */
export function OAuthButtons({ next, scanUrl, intent, source }: { next?: string; scanUrl?: string; intent: "login" | "signup"; source: string }) {
  const providers = enabledProviders();
  const [going, setGoing] = useState<Provider | null>(null);
  const [err, setErr] = useState("");
  if (!providers.length) return null;
  const go = async (p: Provider) => {
    setErr("");
    setGoing(p);
    const back = next ?? `${window.location.pathname}${window.location.search}`;
    if (!(await startOAuth(p, { next: back, scanUrl, intent, source }))) {
      setGoing(null);
      setErr("This browser blocked the sign-in. Please use your email instead, or allow site storage.");
    }
  };
  return (
    <div className="oa">
      <div className="oa-row">
        {providers.map((p) => (
          <button key={p} type="button" className={`oa-btn oa-${p}`} disabled={!!going} onClick={() => void go(p)}>
            {ICONS[p]}
            <span>{going === p ? "Opening…" : `Continue with ${PROVIDER_NAMES[p]}`}</span>
          </button>
        ))}
      </div>
      {err && <p className="lm-err" role="alert">{err}</p>}
      <p className="oa-or"><span>or use your email</span></p>
    </div>
  );
}
