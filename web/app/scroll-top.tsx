"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/* Every internal link opens at the top of its page, including links to the page you are already on. */
export function ScrollTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin) return;
      const samePage = a.pathname === window.location.pathname;
      if (samePage && (!a.hash || a.hash === "#top")) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (a.pathname === "/") window.setTimeout(() => document.getElementById("hero-url")?.focus({ preventScroll: true }), 500);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
