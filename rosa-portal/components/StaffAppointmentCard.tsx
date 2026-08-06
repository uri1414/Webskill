// Staff appointment card — the receptionist's version of the client card. Same
// time-tracking progress bar, countdown, length, and fee; but instead of "what
// to bring" it shows the PREP TASKS for the visit with Start / Done actions and
// a progress count. Server component (the task actions are server actions).
import Link from "next/link";
import { formatMoney } from "@/lib/payments";
import { setTaskStatusAction } from "@/app/dashboard/staff/tasks/actions";

export type CardTask = { id: string; title: string; status: string; statusLabel: string; who: string; dueText: string; overdue: boolean };
type Tone = "green" | "brand" | "grey";

const DAY = 86_400_000;
const WINDOW = 14 * DAY;

function timeInfo(startsAt: string | null): { pct: number; tone: Tone; countdown: string } {
  if (!startsAt) return { pct: 0, tone: "grey", countdown: "Time to be confirmed" };
  const diff = new Date(startsAt).getTime() - Date.now();
  if (diff <= 0) return { pct: 100, tone: "green", countdown: "Happening now" };
  let countdown: string;
  if (diff < 3_600_000) countdown = `In ${Math.max(1, Math.round(diff / 60_000))} min`;
  else if (diff < DAY) countdown = `In ${Math.round(diff / 3_600_000)} hr`;
  else countdown = `In ${Math.round(diff / DAY)} day${Math.round(diff / DAY) === 1 ? "" : "s"}`;
  const pct = Math.min(100, Math.max(4, (1 - diff / WINDOW) * 100));
  const tone: Tone = diff < 2 * DAY ? "green" : "brand";
  return { pct, tone, countdown };
}
function durationLabel(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt || !endsAt) return null;
  const mins = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return [h ? `${h} hr` : null, m ? `${m} min` : null].filter(Boolean).join(" ");
}
function whenLabel(iso: string | null): string {
  if (!iso) return "Time to be confirmed";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const BAR: Record<Tone, string> = { green: "bg-green-500", brand: "bg-brand", grey: "bg-line-strong" };
const CHIP: Record<Tone, string> = { green: "bg-green-50 text-green-700", brand: "bg-brand-soft text-brand-600", grey: "bg-surface-soft text-muted" };
const TASK_CHIP: Record<string, string> = { todo: "bg-surface-soft text-muted", in_progress: "bg-brand-soft text-brand-600", done: "bg-green-50 text-green-700" };

export function StaffAppointmentCard({
  apptId, clientName, title, statusLabel, startsAt, endsAt, due, paid, tasks,
}: {
  apptId: string;
  clientName: string;
  title: string;
  statusLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  due: number;
  paid: number;
  tasks: CardTask[];
}) {
  const t = timeInfo(startsAt);
  const duration = durationLabel(startsAt, endsAt);
  const doneCount = tasks.filter((x) => x.status === "done").length;

  return (
    <div className="lift overflow-hidden rounded-xl border border-line bg-white hover:border-brand hover:shadow-card">
      <Link href={`/dashboard/staff/appointments/${apptId}`} className="block px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{clientName}</p>
            <p className="truncate text-xs text-muted">{title}</p>
          </div>
          <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP[t.tone]}`}>{statusLabel}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{t.countdown}</span>
          <span className="text-xs text-muted">{whenLabel(startsAt)}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-soft">
          <div className={`h-full rounded-full transition-all duration-500 ${BAR[t.tone]}`} style={{ width: `${t.pct}%` }} />
        </div>
        <div className="h-4" />
      </Link>

      {/* Length + fee */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-3 text-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Length</p>
          <p className="font-semibold text-ink">{duration ?? "—"}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Fee</p>
          {due > 0 ? (
            <p className="font-semibold text-amber-700">{formatMoney(due)} due</p>
          ) : paid > 0 ? (
            <p className="font-semibold text-green-700">Paid {formatMoney(paid)}</p>
          ) : (
            <p className="text-muted">No fee</p>
          )}
        </div>
      </div>

      {/* Prep tasks for the receptionist */}
      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Prep tasks</p>
          {tasks.length > 0 && <span className="text-xs font-semibold text-muted">{doneCount}/{tasks.length} done</span>}
        </div>

        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No prep tasks for this visit.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {tasks.map((task) => {
              const done = task.status === "done";
              return (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className={`font-medium ${done ? "text-muted line-through" : "text-ink"}`}>{task.title}</p>
                    <p className="text-xs text-muted">{task.who} · <span className={task.overdue ? "font-semibold text-red-700" : ""}>{task.dueText}</span></p>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${TASK_CHIP[task.status] ?? "bg-surface-soft text-muted"}`}>{task.statusLabel}</span>
                    {task.status === "todo" && (
                      <form action={setTaskStatusAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="appointmentId" value={apptId} />
                        <input type="hidden" name="status" value="in_progress" />
                        <button type="submit" className="rounded-lg border border-line-strong px-2.5 py-1 text-xs font-semibold text-ink transition hover:bg-surface-soft">Start</button>
                      </form>
                    )}
                    {!done && (
                      <form action={setTaskStatusAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="appointmentId" value={apptId} />
                        <input type="hidden" name="status" value="done" />
                        <button type="submit" className="rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-600">Done</button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
