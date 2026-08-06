// Staff Appointments list. Open appointments render as cards — the receptionist's
// view: a time-tracking progress bar, countdown, length, fee, and the prep tasks
// for the visit with Start / Done actions. Recently closed show as compact rows;
// everything older lives in a clearable dropdown. Unpaid past visits flag red.
// RLS scopes to org + staff.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/appointments";
import { formatMoney } from "@/lib/payments";
import { TASK_STATUS_LABEL, listOrgStaff, type TaskStatus } from "@/lib/tasks";
import { StaffAppointmentCard, type CardTask } from "@/components/StaffAppointmentCard";
import { RequestHistory, type HistoryItem } from "@/components/RequestHistory";

type ClientRef = { first_name: string | null; last_name: string | null; business_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "Client";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "Client";
}
function whenLabel(startsAt: string | null): string {
  if (!startsAt) return "No time set";
  const d = new Date(startsAt);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return `Today · ${time}`;
  if (diff === 1) return `Tomorrow · ${time}`;
  if (diff === -1) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}
function dueLabel(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "No due date", overdue: false };
  const d = new Date(iso);
  const overdue = d.getTime() < Date.now();
  const when = d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return { text: overdue ? `Overdue — ${when}` : `Due ${when}`, overdue };
}

const OPEN: AppointmentStatus[] = ["requested", "scheduled", "confirmed", "checked_in"];

type Row = { id: string; title: string | null; starts_at: string | null; ends_at: string | null; status: AppointmentStatus; clients: ClientRef | ClientRef[] | null };

function statusChip(status: AppointmentStatus): string {
  if (status === "confirmed") return "bg-green-50 text-green-700";
  if (status === "requested") return "bg-amber-50 text-amber-700";
  if (status === "cancelled" || status === "no_show") return "bg-red-50 text-red-700";
  if (status === "completed") return "bg-surface-soft text-muted";
  return "bg-brand-soft text-brand-600";
}

export default async function StaffAppointments() {
  const ctx = await requireCapability("appointments.read");
  const supabase = createClient();

  const { data } = await supabase
    .from("appointments")
    .select("id, title, starts_at, ends_at, status, clients(first_name, last_name, business_name)")
    .order("starts_at", { ascending: true, nullsFirst: true });

  const rows = (data ?? []) as Row[];
  const open = rows.filter((r) => OPEN.includes(r.status))
    .sort((a, b) => (a.starts_at ? new Date(a.starts_at).getTime() : Infinity) - (b.starts_at ? new Date(b.starts_at).getTime() : Infinity));
  const done = rows.filter((r) => !OPEN.includes(r.status))
    .sort((a, b) => (b.starts_at ? new Date(b.starts_at).getTime() : 0) - (a.starts_at ? new Date(a.starts_at).getTime() : 0));
  const recentDone = done.slice(0, 3);
  const olderDone = done.slice(3);
  const openIds = open.map((r) => r.id);

  // Fees per appointment.
  const { data: pays } = await supabase.from("payments").select("appointment_id, amount, status").not("appointment_id", "is", null);
  const feeByAppt = new Map<string, { due: number; paid: number }>();
  for (const p of pays ?? []) {
    const k = p.appointment_id as string;
    const cur = feeByAppt.get(k) ?? { due: 0, paid: 0 };
    const amt = Number(p.amount ?? 0);
    if (p.status === "pending") cur.due += amt;
    else if (p.status === "paid") cur.paid += amt;
    feeByAppt.set(k, cur);
  }

  // Prep tasks per open appointment (all statuses, to show progress).
  const staff = await listOrgStaff(ctx.orgId);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const tasksByAppt = new Map<string, CardTask[]>();
  if (openIds.length) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, due_at, assignee_id, appointment_id")
      .in("appointment_id", openIds)
      .order("created_at", { ascending: true });
    for (const t of tasks ?? []) {
      const k = t.appointment_id as string;
      const due = dueLabel(t.due_at as string | null);
      const status = t.status as TaskStatus;
      const arr = tasksByAppt.get(k) ?? [];
      arr.push({
        id: t.id as string,
        title: t.title as string,
        status,
        statusLabel: TASK_STATUS_LABEL[status],
        who: t.assignee_id ? (staffName.get(t.assignee_id as string) ?? "Staff") : "Unassigned",
        dueText: due.text,
        overdue: due.overdue,
      });
      tasksByAppt.set(k, arr);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-xl font-bold text-ink">Appointments</h1>
        <Link href="/dashboard/staff/appointments/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
          <span aria-hidden className="text-base leading-none">+</span> New appointment
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">Schedule, confirm, and complete client appointments.</p>

      <div className="mt-6 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Open</h2>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-600">{open.length}</span>
      </div>
      <div className="mt-2.5 space-y-3">
        {open.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">No open appointments</p>
            <p className="mt-1 text-sm text-muted">Book one, or convert a request into an appointment.</p>
            <Link href="/dashboard/staff/appointments/new" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">New appointment →</Link>
          </div>
        ) : (
          open.map((a) => {
            const fee = feeByAppt.get(a.id) ?? { due: 0, paid: 0 };
            return (
              <StaffAppointmentCard
                key={a.id}
                apptId={a.id}
                clientName={clientName(a.clients)}
                title={a.title || "Appointment"}
                statusLabel={APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}
                startsAt={a.starts_at}
                endsAt={a.ends_at}
                due={fee.due}
                paid={fee.paid}
                tasks={tasksByAppt.get(a.id) ?? []}
              />
            );
          })
        )}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-ink">Recently closed</h2>
          <div className="mt-2.5 space-y-1.5">
            {recentDone.map((a) => {
              const unpaid = (feeByAppt.get(a.id)?.due ?? 0) > 0;
              return (
                <Link key={a.id} href={`/dashboard/staff/appointments/${a.id}`}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition ${
                    unpaid ? "border-red-300 bg-red-50/40 hover:border-red-400" : "border-line bg-white hover:border-line-strong"
                  }`}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{clientName(a.clients)}</span>
                    <span className="block text-xs text-muted">{a.title || "Appointment"} · {whenLabel(a.starts_at)}</span>
                  </span>
                  {unpaid ? (
                    <span className="flex-none rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">{formatMoney(feeByAppt.get(a.id)!.due)} due</span>
                  ) : (
                    <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChip(a.status)}`}>{APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Everything older — tucked away, clearable. Unpaid ones flag red. */}
          <RequestHistory
            items={olderDone.map((a): HistoryItem => {
              const due = feeByAppt.get(a.id)?.due ?? 0;
              if (due > 0) {
                return { id: a.id, subject: `${clientName(a.clients)} · ${a.title || "Appointment"}`, dateText: whenLabel(a.starts_at), statusLabel: `${formatMoney(due)} due`, tone: "red", alert: true };
              }
              const tone: HistoryItem["tone"] = a.status === "cancelled" || a.status === "no_show" ? "red" : a.status === "completed" ? "green" : "grey";
              return { id: a.id, subject: `${clientName(a.clients)} · ${a.title || "Appointment"}`, dateText: whenLabel(a.starts_at), statusLabel: APPOINTMENT_STATUS_LABEL[a.status] ?? a.status, tone };
            })}
            title="Older appointments"
            hrefBase="/dashboard/staff/appointments"
            storageKey="rosa:staff-appt-history-cleared"
          />
        </>
      )}
    </div>
  );
}
