"use client";

import { useEffect, useState } from "react";

// Sticky "On this page" list that highlights the section currently being read.
export function PostToc({ items }: { items: { id: string; text: string }[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const update = () => {
      const line = Math.max(140, window.innerHeight * 0.3); // a heading takes over once it's in the top third
      let current = items[0]?.id ?? "";
      for (const { id } of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      // At the very bottom, the last section can never reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = items[items.length - 1]?.id ?? current;
      }
      setActive(current);
    };
    // A handful of rect reads per scroll event is cheap; no rAF so it never lags a section behind.
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  return (
    <nav className="post-toc" aria-label="On this page">
      <h2>On this page</h2>
      <ol>
        {items.map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              className={active === c.id ? "on" : undefined}
              aria-current={active === c.id ? "location" : undefined}
            >
              {c.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
