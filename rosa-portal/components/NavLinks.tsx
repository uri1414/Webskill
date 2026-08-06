// Primary nav with active-section awareness — answers "Where am I?" at a glance.
// Client component: usePathname highlights the current section; the active pill
// slides between items via a shared layout element (no jump on navigation).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

// Longest-prefix match so /dashboard/staff/requests/123 still lights "Requests".
function activeHref(pathname: string, items: NavItem[]): string | null {
  const matches = items
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + "/"))
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href ?? null;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  const active = activeHref(pathname, items);

  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((it) => {
        const isActive = it.href === active;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative rounded-full px-3 py-1.5 font-semibold transition-colors ${
              isActive ? "bg-brand-soft text-brand-600" : "text-muted hover:bg-surface-soft hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
