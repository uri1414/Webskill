// A list of notifications with per-item behavior: clicking one marks it read
// (its own recipient only, RLS-enforced) and navigates to its target. Shared by
// the bell dropdown and the full inbox.
"use client";

import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/app/dashboard/notifications/actions";
import { noteMeta, relativeTime, type UINote } from "@/lib/notify-ui";

export function NotificationList({ notes, onNavigate }: { notes: UINote[]; onNavigate?: () => void }) {
  const router = useRouter();

  const open = async (n: UINote) => {
    onNavigate?.();
    if (!n.read) {
      try { await markNotificationRead(n.id); } catch { /* best effort */ }
    }
    if (n.link) router.push(n.link);
    else router.refresh();
  };

  if (notes.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-muted">You&apos;re all caught up.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {notes.map((n) => {
        const m = noteMeta(n.type);
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => open(n)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-soft ${n.read ? "" : "bg-brand-soft"}`}
            >
              <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm ${m.tint}`} aria-hidden>
                {m.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${n.read ? "text-ink" : "font-semibold text-ink"}`}>{n.title}</span>
                <span className="mt-0.5 block text-xs text-muted" suppressHydrationWarning>{relativeTime(n.createdAt)}</span>
              </span>
              {!n.read && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand" aria-label="unread" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
