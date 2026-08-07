// Staff Appointment detail — card-format layout. A hero card (client, status,
// time-progress bar, countdown, length, fee, quick links) sits above a two-
// column working area: fees + prep tasks in the main column, and a control rail
// (status actions, reschedule, activity) beside it. Legal moves come from the
// engine (allowedTransitions), so the UI can never offer an illegal one; the
// engine + RLS enforce it server-side.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { APPOINTMENT_STATUS_LABEL, allowedTransitions, type AppointmentStatus } from "@/lib/appointments";
import { formatMoney, PAYMENT_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/payments";
import { TASK_STATUS_LABEL, listOrgStaff, seedDefaultTasks, DEFAULT_TASKS, type TaskStatus } from "@/lib/tasks";
import { resolveServiceKey } from "@/lib/services";
import { TimePicker } from "@/components/TimePicker";
import {
  rescheduleAppointmentAction,
  setAppointmentStatusAction,
  addAppointmentFeeAction,
  markPaymentPaidAction,
  waivePaymentAction,
} from "../actions";
import { createTaskAction, setTaskStatusAction } from "../../tasks/actions";

const PAY_STATUS_CHIP: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  paid: "bg-green-50 text-green-700",
  void: "bg-surface-soft text-muted",
  refunded: "bg-surface-soft text-muted",
  failed: "bg-red-50 text-red-700",
};
const ACTION_LABEL: Record<AppointmentStatus, string> = {
  requested: "Reopen", scheduled: "Mark scheduled", confirmed: "Confirm",
  checked_in: "Check in", completed: "Mark complete", cancelled: "Cancel", no_show: "Mark no-show",
};
const DESTRUCTIVE: AppointmentStatus[] = ["cancelled", "no_show"];
const VERB_LABEL: Record<string, string> = {
  status_changed: "Status changed", scheduled: "Scheduled", rescheduled: "Time updated",
};
const STATUS_TONE: Record<AppointmentStatus, string> = {
  requested: "bg-amber-50 text-amber-700", scheduled: "bg-brand-soft text-brand-600",
  confirmed: "bg-green-50 text-green-700", checked_in: "bg-brand-soft text-brand-600",
  completed: "bg-surface-soft text-muted", cancelled: "bg-red-50 text-red-700", no_show: "bg-red-50 text-red-700",
};

type ClientRef = { first_name: string | null; last_name: string | null; business_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "Client";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "Client";
}

const DAY = 86_400_000;
const WINDOW = 14 * DAY;
function timeInfo(startsAt: string | null, terminal: boolean): { pct: number; bar: string; countdown: string } {
  if (terminal) return { pct: 100, bar: "bg-line-strong", countdown: "Closed" };
  if (!startsAt) return { pct: 0, bar: "bg-line-strong", countdown: "Time to be confirmed" };
  const diff = new Date(startsAt).getTime() - Date.now();
  if (diff <= 0) return { pct: 100, bar: "bg-green-500", countdown: "Happening now" };
  let countdown: string;
  if (diff < 3_600_000) countdown = `In ${Math.max(1, Math.round(diff / 60_000))} min`;
  else if (diff < DAY) countdown = `In ${Math.round(diff / 3_600_000)} hr`;
  else countdown = `In ${Math.round(diff / DAY)} day${Math.round(diff / DAY) === 1 ? "" : "s"}`;
  return { pct: Math.min(100, Math.max(4, (1 - diff / WINDOW) * 100)), bar: diff < 2 * DAY ? "bg-green-500" : "bg-brand", countdown };
}
function durationLabel(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt || !endsAt) return null;
  const mins = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return [h ? `${h} hr` : null, m ? `${m} min` : null].filter(Boolean).join(" ");
}
function whenLabel(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No time set";
}
// Split a stored wall-clock timestamp into date + time defaults for the picker.
function localParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: new Date().toISOString().slice(0, 10), time: "09:00" };
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` };
}

export default async function StaffAppointmentDetail({ params }: { params: { id: string } }) {
  const ctx = await requireCapability("appointments.read");
  const supabase = createClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, title, starts_at, ends_at, status, service_key, client_id, clients(first_name, last_name, business_name)")
    .eq("id", params.id)
    .single();
  if (!appt) return <p className="text-sm text-muted">Appointment not found.</p>;

  const status = appt.status as AppointmentStatus;
  const moves = allowedTransitions(status);
  const terminal = ["completed", "cancelled", "no_show"].includes(status);
  const startsAt = appt.starts_at as string | null;
  const endsAt = appt.ends_at as string | null;

  const { data: rel } = await supabase
    .from("request_relations").select("request_id").eq("entity_type", "appointment").eq("entity_id", params.id).maybeSingle();
  const { data: events } = await supabase
    .from("activity_events").select("verb, from_status, to_status, created_at").eq("entity_type", "appointment").eq("entity_id", params.id).order("created_at", { ascending: true });
  const { data: payments } = await supabase
    .from("payments").select("id, type, amount, status, method, memo, created_at").eq("appointment_id", params.id).order("created_at", { ascending: true });
  const pays = payments ?? [];
  const balanceDue = pays.filter((p) => p.status === "pending").reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const paidTotal = pays.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const clientId = appt.client_id as string;

  const taskCols = "id, title, status, due_at, assignee_id";
  let { data: tasks } = await supabase.from("tasks").select(taskCols).eq("appointment_id", params.id).order("created_at", { ascending: true });
  const serviceKey = resolveServiceKey(appt.service_key as string | null, appt.title as string | null);
  if ((tasks ?? []).length === 0 && serviceKey && DEFAULT_TASKS[serviceKey]) {
    await seedDefaultTasks(ctx, { appointmentId: params.id, clientId, serviceKey, dueAt: startsAt ?? undefined, assigneeId: ctx.userId });
    ({ data: tasks } = await supabase.from("tasks").select(taskCols).eq("appointment_id", params.id).order("created_at", { ascending: true }));
  }
  const prepTasks = tasks ?? [];
  const doneCount = prepTasks.filter((t) => t.status === "done").length;
  const staff = await listOrgStaff(ctx.orgId);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  const t = timeInfo(startsAt, terminal);
  const duration = durationLabel(startsAt, endsAt);
  const parts = localParts(startsAt);
  const existingLen = startsAt && endsAt ? Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000) : 60;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/staff/appointments" className="text-sm text-brand-600">← All appointments</Link>

      {/* Hero card */}
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white">
        <div className="px-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/dashboard/staff/clients/${clientId}`} className="font-display text-xl font-bold text-ink transition hover:text-brand-600">
                {clientName(appt.clients as ClientRef | ClientRef[] | null)} →
              </Link>
              <p className="mt-0.5 text-sm text-muted">{(appt.title as string) || "Appointment"}</p>
            </div>
            <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>{APPOINTMENT_STATUS_LABEL[status] ?? status}</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{t.countdown}</span>
            <span className="text-xs text-muted">{whenLabel(startsAt)}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-soft">
            <div className={`h-full rounded-full transition-all duration-500 ${t.bar}`} style={{ width: `${t.pct}%` }} />
          </div>
          <div className="h-4" />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-5 py-3 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Length</p>
            <p className="font-semibold text-ink">{duration ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Fee</p>
            {balanceDue > 0 ? <p className="font-semibold text-amber-700">{formatMoney(balanceDue)} due</p>
              : paidTotal > 0 ? <p className="font-semibold text-green-700">Paid {formatMoney(paidTotal)}</p>
              : <p className="text-muted">No fee</p>}
          </div>
          <div className="ml-auto flex items-center gap-4">
            {rel?.request_id && <Link href={`/dashboard/staff/requests/${rel.request_id}`} className="font-semibold text-brand-600">Original request →</Link>}
            {startsAt && (
              <a href={`/dashboard/appointments/${appt.id}`} className="inline-flex items-center gap-1.5 font-semibold text-brand-600">
                <span aria-hidden>📅</span> Add to calendar
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          {/* Fees & payments */}
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Fees &amp; payments</p>
              {balanceDue > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{formatMoney(balanceDue)} due</span>}
            </div>

            {pays.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No fees on this appointment.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {pays.map((p) => (
                  <li key={p.id as string} className="rounded-lg border border-line px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{PAYMENT_TYPE_LABEL[p.type as string] ?? (p.type as string)} · {formatMoney(p.amount as number)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAY_STATUS_CHIP[p.status as string] ?? "bg-surface-soft text-muted"}`}>
                        {p.status === "paid" ? `Paid${p.method ? ` · ${PAYMENT_METHOD_LABEL[p.method as string] ?? p.method}` : ""}` : p.status === "void" ? "Waived" : (p.status as string)}
                      </span>
                    </div>
                    {p.memo && <p className="mt-1 text-xs text-muted">{p.memo as string}</p>}
                    {p.status === "pending" && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <form action={markPaymentPaidAction} className="flex items-center gap-2">
                          <input type="hidden" name="appointmentId" value={appt.id as string} />
                          <input type="hidden" name="paymentId" value={p.id as string} />
                          <select name="method" defaultValue="cash" className="rounded-lg border border-line px-2 py-1.5 text-xs text-ink outline-none focus:border-brand">
                            <option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="ach">Bank transfer</option><option value="other">Other</option>
                          </select>
                          <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600">Mark paid</button>
                        </form>
                        <form action={waivePaymentAction}>
                          <input type="hidden" name="appointmentId" value={appt.id as string} />
                          <input type="hidden" name="paymentId" value={p.id as string} />
                          <button type="submit" className="text-xs font-semibold text-muted transition hover:underline">Waive</button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form action={addAppointmentFeeAction} className="mt-4 space-y-2 border-t border-line pt-3">
              <input type="hidden" name="appointmentId" value={appt.id as string} />
              <input type="hidden" name="clientId" value={clientId} />
              <p className="text-xs font-semibold uppercase text-muted">Add a fee</p>
              <div className="flex flex-wrap gap-2">
                <select name="type" defaultValue="service_fee" className="rounded-lg border border-line px-2 py-2 text-sm text-ink outline-none focus:border-brand">
                  <option value="service_fee">Service fee</option><option value="cancellation_fee">Cancellation fee</option><option value="no_show_fee">No-show fee</option><option value="deposit">Deposit</option>
                </select>
                <div className="flex flex-1 items-center rounded-lg border border-line pl-3 focus-within:border-brand">
                  <span className="text-sm text-muted">$</span>
                  <input name="amount" type="number" min="0" step="0.01" inputMode="decimal" required placeholder="0.00" className="w-full rounded-lg px-2 py-2 text-sm text-ink outline-none" />
                </div>
              </div>
              <input name="memo" placeholder="Note (optional)" className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
              <button type="submit" className="rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">Add fee</button>
            </form>
          </div>

          {/* Preparation tasks */}
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Preparation</p>
              {prepTasks.length > 0 && <span className="text-xs font-semibold text-muted">{doneCount}/{prepTasks.length} done</span>}
            </div>
            {prepTasks.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No prep tasks. Add what needs doing before this appointment.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {prepTasks.map((tk) => {
                  const st = tk.status as TaskStatus;
                  const done = st === "done";
                  const who = tk.assignee_id ? (staffName.get(tk.assignee_id as string) ?? "Staff") : "Unassigned";
                  return (
                    <li key={tk.id as string} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className={`font-medium ${done ? "text-muted line-through" : "text-ink"}`}>{tk.title as string}</p>
                        <p className="text-xs text-muted">{who}{tk.due_at ? ` · due ${new Date(tk.due_at as string).toLocaleDateString()}` : ""} · {TASK_STATUS_LABEL[st]}</p>
                      </div>
                      <div className="flex flex-none gap-1.5">
                        {st === "todo" && (
                          <form action={setTaskStatusAction}>
                            <input type="hidden" name="taskId" value={tk.id as string} />
                            <input type="hidden" name="appointmentId" value={appt.id as string} />
                            <input type="hidden" name="status" value="in_progress" />
                            <button type="submit" className="rounded-lg border border-line-strong px-2.5 py-1 text-xs font-semibold text-ink transition hover:bg-surface-soft">Start</button>
                          </form>
                        )}
                        {!done && (
                          <form action={setTaskStatusAction}>
                            <input type="hidden" name="taskId" value={tk.id as string} />
                            <input type="hidden" name="appointmentId" value={appt.id as string} />
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

            <form action={createTaskAction} className="mt-4 space-y-2 border-t border-line pt-3">
              <input type="hidden" name="appointmentId" value={appt.id as string} />
              <input type="hidden" name="clientId" value={clientId} />
              <p className="text-xs font-semibold uppercase text-muted">Add a task</p>
              <input name="title" required placeholder="e.g. Prepare client folder" className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
              <div className="flex flex-wrap gap-2">
                <select name="assignee_id" defaultValue={ctx.userId} className="rounded-lg border border-line px-2 py-2 text-sm text-ink outline-none focus:border-brand">
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input name="due_at" type="datetime-local" className="flex-1 rounded-lg border border-line px-2 py-2 text-sm text-ink outline-none focus:border-brand" />
              </div>
              <button type="submit" className="rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">Add task</button>
            </form>
          </div>
        </div>

        {/* Control rail */}
        <aside className="space-y-5">
          {/* Update status */}
          {moves.length > 0 && (
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-sm font-semibold text-ink">Update status</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {moves.map((to) => (
                  <form key={to} action={setAppointmentStatusAction}>
                    <input type="hidden" name="appointmentId" value={appt.id as string} />
                    <input type="hidden" name="status" value={to} />
                    <button type="submit" className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${DESTRUCTIVE.includes(to) ? "border border-red-200 text-red-700 hover:bg-red-50" : "border border-line-strong text-ink hover:bg-surface-soft"}`}>
                      {ACTION_LABEL[to] ?? to}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}

          {/* Reschedule / set time — bubbles */}
          {!terminal && (
            <form action={rescheduleAppointmentAction} className="rounded-xl border border-line bg-white p-4">
              <p className="text-sm font-semibold text-ink">{startsAt ? "Reschedule" : "Set the appointment time"}</p>
              <input type="hidden" name="appointmentId" value={appt.id as string} />
              <div className="mt-3">
                <TimePicker mode="schedule" defaultDate={parts.date} defaultTime={parts.time} defaultLength={existingLen || 60} showLength dateRequired />
              </div>
              <button type="submit" className="mt-3 w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
                {startsAt ? "Update time" : "Schedule"}
              </button>
            </form>
          )}

          {/* Activity */}
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-sm font-semibold text-ink">Activity</p>
            <ol className="mt-2 space-y-1.5 border-l border-line pl-4 text-sm">
              {(events ?? []).map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand" />
                  <span className="text-ink">{VERB_LABEL[e.verb as string] ?? (e.verb as string)}</span>
                  {e.to_status && <span className="text-muted"> → {APPOINTMENT_STATUS_LABEL[e.to_status as AppointmentStatus] ?? (e.to_status as string)}</span>}
                  <span className="mt-0.5 block text-xs text-muted">{new Date(e.created_at as string).toLocaleString()}</span>
                </li>
              ))}
              {(events ?? []).length === 0 && <li className="text-muted">No activity yet.</li>}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
