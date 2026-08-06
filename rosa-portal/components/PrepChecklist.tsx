// Client-facing preparation checklist — the "what to bring" list, but tickable
// so a client can track what they've gathered. State persists in the browser
// (localStorage, keyed by appointment) so it survives a reload; it's a personal
// aid, not shared data, so no DB is involved.
"use client";

import { useEffect, useState } from "react";

export function PrepChecklist({
  id,
  bring,
  avoid,
  note,
}: {
  id: string;
  bring: string[];
  avoid?: string[];
  note?: string;
}) {
  const key = `prep:${id}`;
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(key);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [key]);

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = { ...prev, [i]: !prev[i] };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const done = bring.filter((_, i) => checked[i]).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">What to bring</p>
        {mounted && <span className="text-xs font-semibold text-muted">{done}/{bring.length}</span>}
      </div>
      <ul className="mt-2 space-y-1.5">
        {bring.map((b, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!checked[i]}
                onChange={() => toggle(i)}
                className="mt-0.5 h-4 w-4 flex-none accent-brand"
              />
              <span className={checked[i] ? "text-muted line-through" : "text-ink"}>{b}</span>
            </label>
          </li>
        ))}
      </ul>
      {avoid && avoid.length > 0 && (
        <ul className="mt-3 space-y-1">
          {avoid.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted"><span aria-hidden className="text-red-600">✕</span>{b}</li>
          ))}
        </ul>
      )}
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </div>
  );
}
