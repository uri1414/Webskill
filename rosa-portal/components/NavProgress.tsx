// Top navigation progress bar — the "it's loading" feedback the browser's own
// spinner gives on full page loads but NOT on Next's client-side navigations.
// It starts the instant a link/row is clicked and completes when the new route
// renders, so pressing anything feels responsive even while the server works.
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickle = useRef<number | null>(null);
  const done = useRef<number | null>(null);

  function clearTimers() {
    if (trickle.current) window.clearInterval(trickle.current);
    if (done.current) window.clearTimeout(done.current);
    trickle.current = null;
    done.current = null;
  }

  function start() {
    clearTimers();
    setVisible(true);
    setWidth(8);
    // Ease toward ~90% while we wait — never quite finishing until the route lands.
    trickle.current = window.setInterval(() => {
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.15 : w));
    }, 200);
  }

  // Any in-app link click begins the bar (captured before navigation happens).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try { url = new URL(a.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Route landed — snap to 100% and fade out.
  useEffect(() => {
    if (!visible) return;
    clearTimers();
    setWidth(100);
    done.current = window.setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 220);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-brand shadow-[0_0_8px_rgba(37,99,235,0.6)]"
        style={{ width: `${width}%`, transition: "width 200ms ease" }}
      />
    </div>
  );
}
