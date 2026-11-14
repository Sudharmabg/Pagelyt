"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoginForm, landing } from "./login/login-form";
import { ModalX, onBackdrop } from "./modal-close";

/* The sign-in modal. Any "Sign in" control calls `openSignIn` (or renders `SignInLink`, a real link to /login that
   opens the modal instead when JavaScript runs). `SignInHost`, mounted once in the root layout, shows it.
   Header sign-in goes to the dashboard; a sign-in from a page gate (`stay`) reloads that page, now signed in.
   "Forgot password?" runs inside the same modal: email, then the 6-digit code with the new password. */

export type SignInOpts = { next?: string; stay?: boolean; forgot?: boolean; email?: string };
const EVENT = "pagelyt:signin";

export function openSignIn(opts: SignInOpts = {}) {
  window.dispatchEvent(new CustomEvent<SignInOpts>(EVENT, { detail: opts }));
}

const loginHref = (o: SignInOpts) => {
  const q = new URLSearchParams();
  if (o.next && o.next !== "/dashboard") q.set("next", o.next);
  if (o.forgot) q.set("forgot", "1");
  const s = q.toString();
  return `/login${s ? `?${s}` : ""}`;
};

/** A link to /login that opens the modal instead (new-tab and modifier clicks still follow the link). */
export function SignInLink({ children, className, next, stay, forgot, email, ...rest }: SignInOpts & { children: React.ReactNode; className?: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      {...rest}
      href={loginHref({ next, forgot })}
      className={className}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        openSignIn({ next, stay, forgot, email });
      }}
    >
      {children}
    </Link>
  );
}

export function SignInHost() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [opts, setOpts] = useState<SignInOpts | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const open = (e: Event) => {
      setOpts((e as CustomEvent<SignInOpts>).detail ?? {});
      setRound((r) => r + 1);
    };
    window.addEventListener(EVENT, open);
    return () => window.removeEventListener(EVENT, open);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (opts && d && !d.open) d.showModal();
  }, [opts, round]);

  const close = () => {
    ref.current?.close();
    setOpts(null);
  };

  const signedIn = async (accessToken: string) => {
    if (opts?.stay) {
      window.location.reload();
      return;
    }
    const to = await landing(opts?.next ?? "/dashboard", accessToken);
    close();
    router.push(to);
  };

  return (
    <dialog ref={ref} className="lead-modal si-modal" aria-label="Sign in" onClose={() => setOpts(null)} onClick={(e) => onBackdrop(e, close)}>
      {opts && (
        <>
          <ModalX onClick={close} />
          <LoginForm key={round} bare next={opts.next ?? "/dashboard"} startForgot={!!opts.forgot} email={opts.email} title="Sign in to Pagelyt" onSignedIn={signedIn} />
          <p className="si-foot">
            New to Pagelyt? <Link href="/" onClick={close}>Run a free scan</Link> to create your account.
          </p>
        </>
      )}
    </dialog>
  );
}
