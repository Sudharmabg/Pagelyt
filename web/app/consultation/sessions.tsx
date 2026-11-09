"use client";

import { CONSULTS } from "../content";
import { SESSION_EVENT } from "../request-form";

/* The three session cards. "Choose" picks that session in the booking form and scrolls to it. */
export function SessionCards() {
  const choose = (i: number) => {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: i }));
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="opts">
      {CONSULTS.map((c, i) => (
        <div className="opt" key={c.t}>
          <div className="opt-top">
            <h3>{c.t}</h3>
            <div className="pr">
              {c.p}
              <small>{c.mins} min</small>
            </div>
          </div>
          <p>{c.d}</p>
          <ul className="opt-get" aria-label="What you get">
            {c.get.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <button type="button" className="fnd-link opt-pick" onClick={() => choose(i)}>
            Choose this session
          </button>
        </div>
      ))}
    </div>
  );
}
