// Collapsible, clearable history section. Completed / closed items pile up and
// become noise, so they live here — collapsed by default, with a "Clear" that
// hides them from this device (localStorage; nothing is deleted server-side,
// and "Show cleared" brings them back). Reused for past requests and past
// appointments via the hrefBase / storageKey / title props.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type HistoryItem = { id: string; subject: string; dateText: string; statusLabel: string; tone: "grey" | "green" | "red" };

const CHIP: Record<HistoryItem["tone"], string> = {
  grey: "bg-surface-soft text-muted",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-700",
};

export function RequestHistory({
  items,
  title = "Past requests",
  hrefBase = "/dashboard/client/requests",
  storageKey = "rosa:req-history-cleared",
}: {
  items: HistoryItem[];
  title?: string;
  hrefBase?: string;
  storageKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setCleared(JSON.parse(raw));
    } catch { /* ignore */ }
    setReady(true);
  }, [storageKey]);

  function persist(next: string[]) {
    setCleared(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const visible = ready ? items.filter((i) => !cleared.includes(i.id)) : items;
  const clearedCount = items.length - visible.length;

  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left"
      >
        <span aria-hidden className={`text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </span>
        <h2 className="font-display text-base font-bold text-ink">{title}</h2>
        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-semibold text-muted">{visible.length}</span>
        {open && visible.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); persist([...cleared, ...visible.map((i) => i.id)]); }}
            className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:underline"
          >
            Clear history
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {visible.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-4 py-6 text-center text-sm text-muted">History cleared.</p>
          ) : (
            visible.map((i) => (
              <Link
                key={i.id}
                href={`${hrefBase}/${i.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm transition hover:border-line-strong"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{i.subject}</span>
                  <span className="block text-xs text-muted">{i.dateText}</span>
                </span>
                <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP[i.tone]}`}>{i.statusLabel}</span>
              </Link>
            ))
          )}

          {clearedCount > 0 && (
            <button type="button" onClick={() => persist([])} className="pl-1 pt-1 text-xs font-semibold text-brand-600 hover:underline">
              Show cleared ({clearedCount})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
