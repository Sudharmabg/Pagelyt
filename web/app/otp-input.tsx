"use client";

import { useEffect, useRef, useState } from "react";

/* The 6-digit email code as six boxes. Underneath it is one real input (so typing, pasting a whole code,
   phone autofill from the email and password managers all just work); the boxes only draw its value.
   The box for the next digit glows, digits pop in as they arrive, and the boxes shake when `error` changes.
   Uncontrolled by default: the form reads it by `name`. */
export function OtpInput({
  id,
  name = "code",
  label = "6-digit code",
  error,
  autoFocus,
  onChange,
}: {
  id: string;
  name?: string;
  label?: string;
  /** Any change to this (a new error message) shakes the boxes. */
  error?: string;
  autoFocus?: boolean;
  onChange?: (digits: string) => void;
}) {
  const [v, setV] = useState("");
  const [focus, setFocus] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!error || !el) return;
    el.classList.remove("shake");
    void el.offsetWidth; // restart the animation
    el.classList.add("shake");
  }, [error]);

  return (
    <div className={`otp${focus ? " focus" : ""}${error ? " bad" : ""}`} ref={wrap}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="otp-in"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={v}
        autoFocus={autoFocus}
        aria-invalid={!!error || undefined}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "").slice(0, 6);
          setV(d);
          onChange?.(d);
        }}
        required
      />
      <div className="otp-boxes" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`otp-box${v[i] ? " full" : ""}${focus && (i === v.length || (v.length === 6 && i === 5)) ? " cur" : ""}`}>
            {v[i] ? <b key={v[i] + i}>{v[i]}</b> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
