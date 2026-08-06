// Staff Appointment detail — reschedule + status actions + activity timeline.
// The legal actions come from the engine (allowedTransitions), so the UI can
// never offer an illegal move; the engine and RLS still enforce it server-side.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import {
  APPOINTMENT_STATUS_LABEL,
  allowedTransitions,
  type AppointmentStatus,
} from "@/lib/appointments";
import { formatMoney, PAYMENT_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/payments";
import { TASK_STATUS_LABEL, listOrgStaff, seedDefaultTasks, DEFAULT_TASKS, type TaskStatus } from "@/lib/tasks";
import { resolveServiceKey } from "@/lib/services";
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

// Friendly verb for each move the engine allows from the current state.
const ACTION_LABEL: Record<AppointmentStatus, string> = {
  requested:  "Reopen",
  scheduled:  "Mark scheduled",
  confirmed:  "Confirm",
  checked_in: "Check in",
  completed:  "Mark complete",
  cancelled:  "Cancel",
  no_show:    "Mark no-show",
};
const DESTRUCTIVE: AppointmentStatus[] = ["cancelled", "no_show"];

const VERB_LABEL: Record<string, string> = {
  status_changed: "Status changed",
  scheduled: "Scheduled",
  rescheduled: "Time updated",
};

type ClientRef = { first_name: string | null; last_name: string | null; business_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "Client";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "Client";
}
function whenLabel(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "No time set";
}
// datetime-local default value from a stored timestamp (wall-clock, consistent
// with how times are entered on convert).
function toLocalInput(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
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

  const { data: rel } = await supabase
    .from("request_relations")
    .select("request_id")
    .eq("entity_type", "appointment")
    .eq("entity_id", params.id)
    .maybeSingle();

  const { data: events } = await supabase
    .from("activity_events")
    .select("verb, from_status, to_status, created_at")
    .eq("entity_type", "appointment")
    .eq("entity_id", params.id)
    .order("created_at", { ascending: true });

  const { data: payments } = await supabase
    .from("payments")
    .select("id, type, amount, status, method, memo, created_at")
    .eq("appointment_id", params.id)
    .order("created_at", { ascending: true });
  const pays = payments ?? [];
  const balanceDue = pays
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const clientId = appt.client_id as string;

  const taskCols = "id, title, status, due_at, assignee_id";
  let { data: tasks } = await supabase
    .from("tasks").select(taskCols).eq("appointment_id", params.id).order("created_at", { ascending: true });

  // Backfill: an appointment made before prep-tasks existed has none. If it has
  // a service with defaults and no tasks yet, generate them now (once) so prep
  // shows up without anyone re-booking.
  const serviceKey = resolveServiceKey(appt.service_key as string | null, appt.title as string | null);
  if ((tasks ?? []).length === 0 && serviceKey && DEFAULT_TASKS[serviceKey]) {
    await seedDefaultTasks(ctx, {
      appointmentId: params.id,
      clientId,
      serviceKey,
      dueAt: (appt.starts_at as string | null) ?? undefined,
      assigneeId: ctx.userId,
    });
    ({ data: tasks } = await supabase
      .from("tasks").select(taskCols).eq("appointment_id", params.id).order("created_at", { ascending: true }));
  }
  const prepTasks = tasks ?? [];
  const staff = await listOrgStaff(ctx.orgId);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/staff/appointments" className="text-sm text-brand-600">← All appointments</Link>
      <h1 className="mt-2 font-display text-xl font-bold text-ink">{(appt.title as string) || "Appointment"}</h1>
      <span className="mt-2 inline-block rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink">
        {APPOINTMENT_STATUS_LABEL[status] ?? status}
      </span>

      <dl className="mt-4 space-y-2 rounded-xl border border-line bg-white p-4 text-sm">
        <div><dt className="text-xs font-semibold uppercase text-muted">Client</dt><dd><Link href={`/dashboard/staff/clients/${clientId}`} className="font-semibold text-brand-600">{clientName(appt.clients as ClientRef | ClientRef[] | null)} →</Link></dd></div>
        <div><dt className="text-xs font-semibold uppercase text-muted">When</dt><dd className="text-ink">{whenLabel(appt.starts_at as string | null)}</dd></div>
        {rel?.request_id && (
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">From request</dt>
            <dd><Link href={`/dashboard/staff/requests/${rel.request_id}`} className="font-semibold text-brand-600">View original request →</Link></dd>
          </div>
        )}
      </dl>

      {/* Add to calendar — universal .ics, works with Apple/Google/Outlook */}
      {appt.starts_at && (
        <a
          href={`/dashboard/appointments/${appt.id}`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft"
        >
          <span aria-hidden>📅</span> Add to calendar
        </a>
      )}

      {/* Reschedule / set time */}
      {status !== "completed" && status !== "cancelled" && status !== "no_show" && (
        <form action={rescheduleAppointmentAction} className="mt-5 space-y-3 rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">{appt.starts_at ? "Reschedule" : "Set the appointment time"}</p>
          <input type="hidden" name="appointmentId" value={appt.id as string} />
          <div>
            <label htmlFor="startsAt" className="block text-xs font-semibold text-muted">Date &amp; time</label>
            <input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={toLocalInput(appt.starts_at as string | null)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
          </div>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
            {appt.starts_at ? "Update time" : "Schedule"}
          </button>
        </form>
      )}

      {/* Status actions — only the moves the engine allows from here */}
      {moves.length > 0 && (
        <div className="mt-5 rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Update status</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {moves.map((to) => (
              <form key={to} action={setAppointmentStatusAction}>
                <input type="hidden" name="appointmentId" value={appt.id as string} />
                <input type="hidden" name="status" value={to} />
                <button
                  type="submit"
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    DESTRUCTIVE.includes(to)
                      ? "border border-red-200 text-red-700 hover:bg-red-50"
                      : "border border-line-strong text-ink hover:bg-surface-soft"
                  }`}
                >
                  {ACTION_LABEL[to] ?? to}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      {/* Fees & payments */}
      <div className="mt-5 rounded-xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Fees &amp; payments</p>
          {balanceDue > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {formatMoney(balanceDue)} due
            </span>
          )}
        </div>

        {pays.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No fees on this appointment.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pays.map((p) => (
              <li key={p.id as string} className="rounded-lg border border-line px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">
                    {PAYMENT_TYPE_LABEL[p.type as string] ?? (p.type as string)} · {formatMoney(p.amount as number)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAY_STATUS_CHIP[p.status as string] ?? "bg-surface-soft text-muted"}`}>
                    {p.status === "paid"
                      ? `Paid${p.method ? ` · ${PAYMENT_METHOD_LABEL[p.method as string] ?? p.method}` : ""}`
                      : p.status === "void" ? "Waived" : (p.status as string)}
                  </span>
                </div>
                {p.memo && <p className="mt-1 text-xs text-muted">{p.memo as string}</p>}

                {p.status === "pending" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={markPaymentPaidAction} className="flex items-center gap-2">
                      <input type="hidden" name="appointmentId" value={appt.id as string} />
                      <input type="hidden" name="paymentId" value={p.id as string} />
                      <select name="method" defaultValue="cash" className="rounded-lg border border-line px-2 py-1.5 text-xs text-ink outline-none focus:border-brand">
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="check">Check</option>
                        <option value="ach">Bank transfer</option>
                        <option value="other">Other</option>
                      </select>
                      <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600">
                        Mark paid
                      </button>
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

        {/* Add a fee */}
        <form action={addAppointmentFeeAction} className="mt-4 space-y-2 border-t border-line pt-3">
          <input type="hidden" name="appointmentId" value={appt.id as string} />
          <input type="hidden" name="clientId" value={clientId} />
          <p className="text-xs font-semibold uppercase text-muted">Add a fee</p>
          <div className="flex flex-wrap gap-2">
            <select name="type" defaultValue="service_fee" className="rounded-lg border border-line px-2 py-2 text-sm text-ink outline-none focus:border-brand">
              <option value="service_fee">Service fee</option>
              <option value="cancellation_fee">Cancellation fee</option>
              <option value="no_show_fee">No-show fee</option>
              <option value="deposit">Deposit</option>
            </select>
            <div className="flex flex-1 items-center rounded-lg border border-line pl-3 focus-within:border-brand">
              <span className="text-sm text-muted">$</span>
              <input name="amount" type="number" min="0" step="0.01" inputMode="decimal" required placeholder="0.00"
                className="w-full rounded-lg px-2 py-2 text-sm text-ink outline-none" />
            </div>
          </div>
          <input name="memo" placeholder="Note (optional)" className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
          <button type="submit" className="rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">
            Add fee
          </button>
        </form>
      </div>

      {/* Preparation tasks */}
      <div className="mt-5 rounded-xl border border-line bg-white p-4">
        <p className="text-sm font-semibold text-ink">Preparation</p>
        {prepTasks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No prep tasks. Add what needs doing before this appointment.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {prepTasks.map((t) => {
              const status = t.status as TaskStatus;
              const done = status === "done";
              const who = t.assignee_id ? (staffName.get(t.assignee_id as string) ?? "Staff") : "Unassigned";
              return (
                <li key={t.id as string} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className={`font-medium ${done ? "text-muted line-through" : "text-ink"}`}>{t.title as string}</p>
                    <p className="text-xs text-muted">{who}{t.due_at ? ` · due ${new Date(t.due_at as string).toLocaleDateString()}` : ""} · {TASK_STATUS_LABEL[status]}</p>
                  </div>
                  <div className="flex flex-none gap-1.5">
                    {status === "todo" && (
                      <form action={setTaskStatusAction}>
                        <input type="hidden" name="taskId" value={t.id as string} />
                        <input type="hidden" name="appointmentId" value={appt.id as string} />
                        <input type="hidden" name="status" value="in_progress" />
                        <button type="submit" className="rounded-lg border border-line-strong px-2.5 py-1 text-xs font-semibold text-ink transition hover:bg-surface-soft">Start</button>
                      </form>
                    )}
                    {!done && (
                      <form action={setTaskStatusAction}>
                        <input type="hidden" name="taskId" value={t.id as string} />
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

        {/* Add a task */}
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

      {/* Activity timeline */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-ink">Activity</h2>
        <ol className="mt-2 space-y-1.5 border-l border-line pl-4 text-sm">
          {(events ?? []).map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand" />
              <span className="text-ink">{VERB_LABEL[e.verb as string] ?? (e.verb as string)}</span>
              {e.to_status && <span className="text-muted"> → {APPOINTMENT_STATUS_LABEL[e.to_status as AppointmentStatus] ?? (e.to_status as string)}</span>}
              <span className="ml-2 text-xs text-muted">{new Date(e.created_at as string).toLocaleString()}</span>
            </li>
          ))}
          {(events ?? []).length === 0 && <li className="text-muted">No activity yet.</li>}
        </ol>
      </div>
    </div>
  );
}
