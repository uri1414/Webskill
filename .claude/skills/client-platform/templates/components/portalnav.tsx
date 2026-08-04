"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { label: string; href?: string; badge?: string };

// Mobile-only horizontal section switcher (sidebar hides on phones).
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const routed = items.filter((it) => it.href);
  if (routed.length === 0) return null;
  const isActive = (href?: string) => !!href && (pathname === href || pathname.startsWith(`${href}/`));
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-line bg-white px-4 py-2.5 md:hidden">
      {routed.map((it) => (
        <Link key={it.label} href={it.href!} className={`flex-none whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${isActive(it.href) ? "bg-brand text-white" : "border border-line text-body"}`}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}

// Header title that follows the active route.
export function PortalTitle({ items, fallback }: { items: NavItem[]; fallback: string }) {
  const pathname = usePathname();
  const match = items.filter((it) => it.href).sort((a, b) => b.href!.length - a.href!.length)
    .find((it) => pathname === it.href || pathname.startsWith(`${it.href}/`));
  return <>{match?.label ?? fallback}</>;
}

// Routed sidebar nav; items with an href link + highlight when active.
export function PortalNav({ items, dark = false }: { items: NavItem[]; dark?: boolean }) {
  const pathname = usePathname();
  const isActive = (href?: string) => !!href && (pathname === href || pathname.startsWith(`${href}/`));
  const anyActive = items.some((it) => isActive(it.href));
  return (
    <nav className="mt-1 flex flex-col gap-0.5">
      {items.map((it, i) => {
        const active = it.href ? isActive(it.href) : !anyActive && i === 0;
        const base = "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm transition";
        const activeCls = dark ? "bg-ink-800 font-semibold text-white" : "bg-brand font-semibold text-white";
        const idleCls = dark ? "font-medium text-[#9AA1B2] hover:bg-ink-800" : "font-medium text-body hover:bg-surface-soft";
        const inner = (
          <>
            <span className={`h-2 w-2 flex-none rounded-full ${active ? (dark ? "bg-accent" : "bg-white") : (dark ? "bg-[#2A2F3C]" : "bg-line-strong")}`} />
            <span className="flex-1">{it.label}</span>
            {it.badge ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-[#B42318] text-white"}`}>{it.badge}</span> : null}
          </>
        );
        return it.href
          ? <Link key={it.label} href={it.href} className={`${base} ${active ? activeCls : idleCls}`}>{inner}</Link>
          : <div key={it.label} className={`${base} cursor-default ${active ? activeCls : idleCls}`}>{inner}</div>;
      })}
    </nav>
  );
}
