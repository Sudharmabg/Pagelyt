"use client";

/* First focusable element on every page. Jumps to the page's <main>, whatever its id, so no page needs an id="main". */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(e) => {
        const main = document.querySelector("main");
        if (!main) return;
        e.preventDefault();
        // Some pages (the home page) render the site nav inside <main>: land on the first block after it.
        let target: HTMLElement = main;
        for (const el of Array.from(main.children) as HTMLElement[]) {
          if (el.matches("nav, header") || el.querySelector(":scope > nav")) continue;
          target = el;
          break;
        }
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.setAttribute("data-skip-target", "");
        target.focus({ preventScroll: true });
        target.scrollIntoView();
      }}
    >
      Skip to content
    </a>
  );
}
