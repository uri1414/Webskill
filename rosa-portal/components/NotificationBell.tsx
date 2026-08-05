// The notification center — the bell in the top-right every app has. Reads the
// signed-in user's own notifications (recorded by the delivery seam, e.g. when
// an appointment is confirmed) and shows an unread count + a dropdown list.
// Client component for the open/close + mark-read interaction; the data is
// fetched server-side in the dashboard layout and passed in.
"use client";

import { useState } from "react";
import Link from "next/link";
import { markAllNotificationsRead } from "@/app/dashboard/notifications/actions";

export type BellNote = {
  id: string;
  title: string;
  link: string | null;
  createdAt: string;
  read: boolean;
};

export function NotificationBell({ notifications, unread }: { notifications: BellNote[]; unread: number }) {
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
          {/* click-away backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[86vw] overflow-hidden rounded-xl border border-line bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-sm font-semibold text-ink">Notifications</span>
              {unread > 0 && (
                <form action={markAllNotificationsRead}>
                  <button type="submit" className="text-xs font-semibold text-brand-600 hover:underline">
                    Mark all read
                  </button>
                </form>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">You&apos;re all caught up.</p>
              ) : (
                notifications.map((n) => {
                  const inner = (
                    <div className={`flex gap-2.5 px-4 py-3 ${n.read ? "" : "bg-brand-soft"}`}>
                      <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.read ? "bg-transparent" : "bg-brand"}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{n.title}</p>
                        <p className="mt-0.5 text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                  return n.link ? (
                    <Link
                      key={n.id}
                      href={n.link}
                      onClick={() => setOpen(false)}
                      className="block border-b border-line last:border-0 hover:bg-surface-soft"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id} className="border-b border-line last:border-0">{inner}</div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
