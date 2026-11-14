"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useSignedInUser } from "@/lib/use-signed-in";
import { SignInLink } from "@/app/sign-in-modal";

/* The header's account control. Visitors get an outlined "Sign in". Once signed in it shows who is signed in
   (initial, name, "Signed in") and opens a menu with the email, Account and Log out. */
export function AuthLink({ compact = false }: { compact?: boolean }) {
  const user = useSignedInUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!user) {
    return (
      <SignInLink className="btn sm outline" aria-busy={user === undefined}>
        Sign in
      </SignInLink>
    );
  }

  const logOut = async () => {
    setOpen(false);
    await supabaseBrowser()?.auth.signOut({ scope: "local" });
    router.push("/");
    router.refresh();
  };

  return (
    <div className={`acct-menu${compact ? " compact" : ""}`} ref={box}>
      <button type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="acct-av" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
        <span className="acct-who">
          <b>{user.name}</b>
          <small><i aria-hidden="true" /> Signed in</small>
        </span>
      </button>
      {open && (
        <div className="acct-pop" role="menu">
          <p className="acct-mail">
            Signed in as <strong>{user.email}</strong>
          </p>
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)}>Account</Link>
          <button role="menuitem" type="button" onClick={logOut}>Log out</button>
        </div>
      )}
    </div>
  );
}
