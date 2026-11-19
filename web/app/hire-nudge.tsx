"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { HireWho } from "./hire-modal";

/* "Work with me": after each fresh sign-in (at most once a week per device) a small lilac pill pops in at the
   corner and morphs into a modal offering Sudharma's freelance work. Sending a request stores a `freelance`
   request (admin Requests tab) and stops the automatic nudge for that account on this device. It waits while
   any other dialog is open and never shows on admin, auth or print pages. The account menu's "Hire the
   developer" reopens it any time (`openHire`). Visitors who are not signed in see the same pill floating at the
   bottom right of the home page (it stays put until clicked or dismissed for the session); their modal asks for a
   name and email plus the human check. This file stays small: the modal's code loads only when used. */

const HireModal = dynamic(() => import("./hire-modal"), { ssr: false });
const preload = () => void import("./hire-modal");

const EVENT = "pagelyt:hire";
/** Opens the modal, morphing out of `from` (e.g. the button that was clicked). */
export function openHire(from?: Element | null) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: from?.getBoundingClientRect() ?? null }));
}

const WEEK = 7 * 24 * 60 * 60 * 1000;
const GUEST_KEY = "pagelyt:hire:guest"; // "hidden" (dismissed this session) or "sent"
function guestOff() {
  try {
    return sessionStorage.getItem(GUEST_KEY) === "hidden" || localStorage.getItem(GUEST_KEY) === "sent";
  } catch {
    return false;
  }
}
function setGuest(v: "hidden" | "sent") {
  try {
    (v === "sent" ? localStorage : sessionStorage).setItem(GUEST_KEY, v);
  } catch {
    /* private mode */
  }
}
const HIDDEN_ON = ["/admin", "/auth", "/print", "/login", "/check-email"];

type Seen = { signIn?: string; at?: number; sent?: number };
const keyOf = (uid: string) => `pagelyt:hire:${uid}`;
function readSeen(uid: string): Seen | null | false {
  try {
    return JSON.parse(localStorage.getItem(keyOf(uid)) ?? "null") as Seen | null;
  } catch {
    return false; // no storage: don't risk nudging on every page
  }
}
function writeSeen(uid: string, patch: Seen) {
  try {
    localStorage.setItem(keyOf(uid), JSON.stringify({ ...(readSeen(uid) || {}), ...patch }));
  } catch {
    /* private mode */
  }
}
function due(uid: string, signIn: string) {
  const seen = readSeen(uid);
  if (seen === false) return false;
  return !seen || (!seen.sent && seen.signIn !== signIn && Date.now() - (seen.at ?? 0) > WEEK);
}
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Phase = "wait" | "pill" | "open" | "done";

export function HireNudge() {
  const path = usePathname() ?? "/";
  const [who, setWho] = useState<(HireWho & { signIn: string }) | null>(null);
  const [known, setKnown] = useState(() => !supabaseBrowser()); // signed-in state checked (no Supabase: always a guest)
  const [phase, setPhase] = useState<Phase>("wait");
  const [from, setFrom] = useState<DOMRect | null>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const hidden = HIDDEN_ON.some((p) => path === p || path.startsWith(`${p}/`));

  // Who is signed in, and when that sign-in happened (a new sign-in is a new chance to nudge).
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const read = (s: Awaited<ReturnType<typeof sb.auth.getSession>>["data"]["session"]) => {
      if (!s) return setWho(null);
      const meta = s.user.user_metadata as { name?: unknown } | undefined;
      const email = s.user.email ?? "";
      setWho({
        uid: s.user.id,
        signIn: s.user.last_sign_in_at ?? "",
        name: typeof meta?.name === "string" && meta.name.trim() ? meta.name.trim() : email.split("@")[0],
        email,
        token: s.access_token,
      });
    };
    void sb.auth.getSession().then(({ data }) => {
      read(data.session);
      setKnown(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => read(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Pop the pill once the page has settled and no other dialog is up.
  useEffect(() => {
    if (phase !== "wait" || !who || hidden || !due(who.uid, who.signIn)) return;
    let t = 0;
    const tryShow = () => {
      if (document.querySelector("dialog[open]")) {
        t = window.setTimeout(tryShow, 1200);
        return;
      }
      writeSeen(who.uid, { signIn: who.signIn, at: Date.now() });
      preload(); // fetch the modal's code while the pill is on screen
      if (calm()) {
        setFrom(null);
        setPhase("open");
      } else setPhase("pill");
    };
    t = window.setTimeout(tryShow, 1500);
    return () => window.clearTimeout(t);
  }, [phase, who, hidden]);

  // Guests: the pill floats on the home page and waits to be clicked.
  useEffect(() => {
    if (phase !== "wait" || !known || who || path !== "/" || guestOff()) return;
    const t = window.setTimeout(() => setPhase("pill"), 2200);
    return () => window.clearTimeout(t);
  }, [phase, known, who, path]);

  const expand = useCallback(() => {
    setFrom(pill.current?.getBoundingClientRect() ?? null);
    setPhase("open");
  }, []);

  // For signed-in people the pill expands on its own after a moment (or sooner on click).
  useEffect(() => {
    if (phase !== "pill" || !who) return;
    const t = window.setTimeout(expand, 1900);
    return () => window.clearTimeout(t);
  }, [phase, who, expand]);

  // Opened on demand (account menu).
  useEffect(() => {
    const on = (e: Event) => {
      setFrom((e as CustomEvent<DOMRect | null>).detail ?? null);
      setPhase("open");
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  if (phase === "wait" || phase === "done") return null;
  // A guest's pill only belongs on the home page; a signed-in person's follows them until it expands.
  if (phase === "pill" && !who && path !== "/") return null;
  if (phase === "pill") {
    const btn = (
      <button ref={pill} type="button" className="hn-pill" onClick={expand} onPointerEnter={preload} onFocus={preload} aria-label="Need a developer? Open the offer">
        <span className="hn-av" aria-hidden="true">SB</span>
        <span className="hn-pill-t">Need a developer?</span>
        <span className="hn-wave" aria-hidden="true">👋</span>
      </button>
    );
    if (who) return btn;
    return (
      <div className="hn-float">
        {btn}
        <button
          type="button"
          className="hn-float-x"
          aria-label="Hide for now"
          onClick={() => {
            setGuest("hidden");
            setPhase("done");
          }}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
      </div>
    );
  }
  return (
    <HireModal
      who={who}
      from={from}
      onSent={() => (who ? writeSeen(who.uid, { sent: Date.now() }) : setGuest("sent"))}
      // A guest who closes without sending gets the floating pill back.
      onClosed={(sent) => setPhase(!who && !sent && path === "/" ? "pill" : "done")}
    />
  );
}
