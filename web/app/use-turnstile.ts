"use client";

import { useCallback, useEffect, useRef } from "react";

type TurnstileApi = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void };

/* Cloudflare Turnstile (human check) for a form. Only loads when a site key is configured. Attach `box` to an
   empty <div>, read `token()` when submitting, and call `reset()` after every attempt: a token works once. */
export function useTurnstile(active = true) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const value = useRef<string | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!active || !siteKey || !box.current) return;
    value.current = undefined;
    const mount = () => {
      const w = window as unknown as { turnstile?: TurnstileApi };
      if (w.turnstile && box.current && !box.current.hasChildNodes()) {
        widget.current = w.turnstile.render(box.current, { sitekey: siteKey, callback: (t: string) => { value.current = t; }, "expired-callback": () => { value.current = undefined; }, "error-callback": (code: string) => { value.current = undefined; console.warn(`[turnstile] browser check failed: ${code}`); } });
      }
    };
    if (document.getElementById("cf-turnstile-js")) return mount();
    const sc = document.createElement("script");
    sc.id = "cf-turnstile-js";
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    sc.async = true;
    sc.onload = mount;
    document.head.append(sc);
  }, [active, siteKey]);

  const reset = useCallback(() => {
    value.current = undefined;
    try {
      if (widget.current) (window as unknown as { turnstile?: TurnstileApi }).turnstile?.reset(widget.current);
    } catch {
      /* the widget is gone (its box re-rendered); the next mount draws a new one */
    }
  }, []);

  return { box, siteKey, token: () => value.current, reset };
}
