// Staff Tasks dashboard — every open preparation task, so nothing falls through
// before a client arrives. Reads existing task rows (RLS: staff-only); assignee
// names resolved via listOrgStaff. Overdue items are flagged.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { TASK_STATUS_LABEL, OPEN_TASK_STATUSES, listOrgStaff, type TaskStatus } from "@/lib/tasks";
import { setTaskStatusAction } from "./actions";

type ClientRef = { business_name: string | null; first_name: string | null; last_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "";
}
function dueLabel(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "No due date", overdue: false };
  const d = new Date(iso);
  const overdue = d.getTime() < Date.now();
  return { text: d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), overdue };
}

export default async function StaffTasks() {
  const ctx = await requireCapability("tasks.read");
  const supabase = createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, due_at, appointment_id, assignee_id, clients(business_name, first_name, last_name)")
    .in("status", OPEN_TASK_STATUSES)
    .order("due_at", { ascending: true, nullsFirst: false });
  const staff = await listOrgStaff(ctx.orgId);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const rows = tasks ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-xl font-bold text-ink">Preparation tasks</h1>
      <p className="mt-1 text-sm text-muted">Open prep for upcoming appointments. Keep these clear before clients arrive.</p>

      <div className="mt-6 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">Nothing to prepare right now. 🎉</p>
        ) : rows.map((t) => {
          const due = dueLabel(t.due_at as string | null);
          const status = t.status as TaskStatus;
          const who = t.assignee_id ? (staffName.get(t.assignee_id as string) ?? "Staff") : "Unassigned";
          const cn = clientName(t.clients as ClientRef | ClientRef[] | null);
          return (
            <div key={t.id as string} className="rounded-xl border border-line bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{t.title as string}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {cn && <>{cn} · </>}
                    {who}
                    {" · "}
                    <span className={due.overdue ? "font-semibold text-red-700" : ""}>{due.overdue ? "Overdue — " : "Due "}{due.text}</span>
                    {t.appointment_id && <> · <Link href={`/dashboard/staff/appointments/${t.appointment_id}`} className="font-semibold text-brand-600">appointment →</Link></>}
                  </p>
                </div>
                <span className="flex-none rounded-full bg-surface-soft px-2 py-0.5 text-xs font-semibold text-muted">{TASK_STATUS_LABEL[status]}</span>
              </div>
              <div className="mt-2 flex gap-2">
                {status === "todo" && (
                  <form action={setTaskStatusAction}>
                    <input type="hidden" name="taskId" value={t.id as string} />
                    <input type="hidden" name="status" value="in_progress" />
                    <button type="submit" className="rounded-lg border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-soft">Start</button>
                  </form>
                )}
                <form action={setTaskStatusAction}>
                  <input type="hidden" name="taskId" value={t.id as string} />
                  <input type="hidden" name="status" value="done" />
                  <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600">Mark done</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
