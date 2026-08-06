// The notification center — the bell in the top-right. Shows an unread count and
// a dropdown of the most recent notifications (icons, relative time, click to
// open + mark read). "See all" opens the full inbox. Data is fetched
// server-side in the dashboard layout and passed in.
"use client";

import { useState } from "react";
import Link from "next/link";
import { markAllNotificationsRead } from "@/app/dashboard/notifications/actions";
import { NotificationList } from "@/components/NotificationList";
import { type UINote } from "@/lib/notify-ui";

export function NotificationBell({ notifications, unread }: { notifications: UINote[]; unread: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-ink transition hover:bg-surface-soft"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a1.9 1.9 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[86vw] overflow-hidden rounded-xl border border-line bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-sm font-semibold text-ink">Notifications</span>
              {unread > 0 && (
                <form action={markAllNotificationsRead}>
                  <button type="submit" className="text-xs font-semibold text-brand-600 hover:underline">Mark all read</button>
                </form>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              <NotificationList notes={notifications.slice(0, 8)} onNavigate={() => setOpen(false)} />
            </div>

            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="block border-t border-line px-4 py-2.5 text-center text-sm font-semibold text-brand-600 hover:bg-surface-soft"
            >
              See all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
