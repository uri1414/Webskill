// One client's prep-task box. Collapsed, it previews the client's open tasks
// (count, overdue flag, the first couple of titles). Click the header to expand
// the full list with Start / Mark done actions. Clients with more tasks take
// more room when open — the list is per client, not one long flat list.
"use client";

import { useState } from "react";
import { setTaskStatusAction } from "@/app/dashboard/staff/tasks/actions";

export type UITask = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  dueText: string;
  overdue: boolean;
  appointmentId: string | null;
  who: string;
};

const STATUS_CHIP: Record<string, string> = {
  todo: "bg-surface-soft text-muted",
  in_progress: "bg-brand-soft text-brand-600",
  done: "bg-green-50 text-green-700",
};

export function ClientTaskCard({
  name, initials, tasks, overdueCount,
}: {
  name: string;
  initials: string;
  tasks: UITask[];
  overdueCount: number;
}) {
  const [open, setOpen] = useState(overdueCount > 0); // overdue clients start open
  const preview = tasks.slice(0, 2).map((t) => t.title).join(" · ");

  return (
    <div className="lift rounded-xl border border-line bg-white hover:border-brand hover:shadow-card">
      {/* Header — the whole strip toggles the box */}
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left">
        <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-600">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-ink">{name}</p>
            <span className="flex-none rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-semibold text-muted">{tasks.length} task{tasks.length > 1 ? "s" : ""}</span>
            {overdueCount > 0 && (
              <span className="flex-none rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">⚠︎ {overdueCount} overdue</span>
            )}
          </div>
          {!open && <p className="mt-0.5 truncate text-sm text-muted">{preview}{tasks.length > 2 ? ` · +${tasks.length - 2} more` : ""}</p>}
        </div>
        <span aria-hidden className={`flex-none text-muted transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </span>
      </button>

      {/* Expanded — the full task list for this client */}
      {open && (
        <div className="space-y-2 border-t border-line px-4 py-3">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-ink">{t.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {t.who}
                  {" · "}
                  <span className={t.overdue ? "font-semibold text-red-700" : ""}>{t.dueText}</span>
                  {t.appointmentId && (
                    <> · <a href={`/dashboard/staff/appointments/${t.appointmentId}`} className="font-semibold text-brand-600">appointment →</a></>
                  )}
                </p>
              </div>
              <div className="flex flex-none items-center gap-1.5">
                <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${STATUS_CHIP[t.status] ?? "bg-surface-soft text-muted"}`}>{t.statusLabel}</span>
                {t.status === "todo" && (
                  <form action={setTaskStatusAction}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <input type="hidden" name="status" value="in_progress" />
                    <button type="submit" className="rounded-lg border border-line-strong px-2.5 py-1 text-xs font-semibold text-ink transition hover:bg-surface-soft">Start</button>
                  </form>
                )}
                <form action={setTaskStatusAction}>
                  <input type="hidden" name="taskId" value={t.id} />
                  <input type="hidden" name="status" value="done" />
                  <button type="submit" className="rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-600">Done</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
