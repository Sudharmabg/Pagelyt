"use client";

import { useState } from "react";
import { FAQS } from "../content";

export function FaqList() {
  const [open, setOpen] = useState(0);
  return (
    <div className="faq">
      {FAQS.map(([q, a], i) => (
        <div className={`qa${open === i ? " open" : ""}`} key={q}>
          <button aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            {q}
            <span className="pm" aria-hidden="true" />
          </button>
          <div className="ans">
            <div>
              <p>{a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
