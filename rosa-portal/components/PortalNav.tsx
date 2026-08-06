// Sidebar navigation for the dashboard shell — ported from the Baseline Studio
// platform so the Rosa portal shares the same setup: a vertical, route-aware
// nav in the sidebar, a matching page title in the header, and a horizontal
// switcher on mobile where the sidebar is hidden.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { label: string; href: string; badge?: string };

// The two "home" roots must match exactly, so their sub-routes (e.g.
// /dashboard/staff/requests) don't also keep Home lit.
const HOME_ROOTS = ["/dashboard/staff", "/dashboard/client"];
function useIsActive() {
  const pathname = usePathname() ?? "";
  return (href: string) => {
    if (HOME_ROOTS.includes(href)) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

// Horizontally-scrollable section switcher shown only on mobile.
export function MobileNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-line bg-white px-4 py-2.5 md:hidden">
      {items.map((it) => {
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex-none whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              active ? "bg-brand text-white" : "border border-line text-body"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

// Header title that follows the active route (longest-prefix wins).
export function PortalTitle({ items, fallback }: { items: NavItem[]; fallback: string }) {
  const pathname = usePathname() ?? "";
  const match = items
    .slice()
    .sort((a, b) => b.href.length - a.href.length)
    .find((it) => (HOME_ROOTS.includes(it.href) ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`)));
  return <>{match?.label ?? fallback}</>;
}

// Routed sidebar navigation. Active item is highlighted; a dot marks it.
export function PortalNav({ items, dark = false }: { items: NavItem[]; dark?: boolean }) {
  const isActive = useIsActive();
  return (
    <nav className="mt-1 flex flex-col gap-0.5">
      {items.map((it) => {
        const active = isActive(it.href);
        const base = "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm transition";
        const activeCls = dark ? "bg-ink-800 font-semibold text-white" : "bg-brand font-semibold text-white";
        const idleCls = dark ? "font-medium text-[#9AA1B2] hover:bg-ink-800" : "font-medium text-body hover:bg-surface-soft";
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={`${base} ${active ? activeCls : idleCls}`}>
            <span className={`h-2 w-2 flex-none rounded-full ${active ? (dark ? "bg-accent" : "bg-white") : dark ? "bg-[#2A2F3C]" : "bg-line-strong"}`} />
            <span className="flex-1">{it.label}</span>
            {it.badge ? (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-[#B42318] text-white"}`}>{it.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
