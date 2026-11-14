"use client";

import { useState } from "react";

/* A number on a split-flap board: when it changes, each digit that changed flips its old top half down to
   reveal the new one. Purely visual; screen readers get the plain number. */
export function FlapNum({ n }: { n: number }) {
  const [st, setSt] = useState({ cur: n, prev: n, turn: 0 });
  if (st.cur !== n) setSt({ cur: n, prev: st.cur, turn: st.turn + 1 });
  const now = String(n);
  const was = String(st.prev).padStart(now.length, " ");
  return (
    <span className="flap">
      <span className="sr-only">{n}</span>
      {now.split("").map((d, i) => {
        const old = was[i] ?? " ";
        const moved = st.turn > 0 && old !== d;
        return (
          <span key={`${i}-${moved ? st.turn : 0}`} className={`fl${moved ? " go" : ""}`} aria-hidden="true" style={{ ["--fi" as string]: i }}>
            <span className="fl-new">{d}</span>
            {moved && <span className="fl-old">{old.trim()}</span>}
          </span>
        );
      })}
    </span>
  );
}
