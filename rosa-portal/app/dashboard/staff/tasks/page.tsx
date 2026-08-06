// Staff Tasks dashboard — prep grouped BY CLIENT. Each client gets one box that
// previews their open tasks; click it to expand the full list with actions.
// Clients with more prep take more space when open. RLS: staff-only; assignee
// names via listOrgStaff.
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { TASK_STATUS_LABEL, OPEN_TASK_STATUSES, listOrgStaff, type TaskStatus } from "@/lib/tasks";
import { ClientTaskCard, type UITask } from "@/components/ClientTaskCard";

type ClientRef = { business_name: string | null; first_name: string | null; last_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "No client";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "No client";
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}
function dueLabel(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "No due date", overdue: false };
  const d = new Date(iso);
  const overdue = d.getTime() < Date.now();
  const when = d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return { text: overdue ? `Overdue — ${when}` : `Due ${when}`, overdue };
}

type Group = { clientId: string; name: string; tasks: UITask[]; overdueCount: number };

export default async function StaffTasks() {
  const ctx = await requireCapability("tasks.read");
  const supabase = createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, due_at, appointment_id, assignee_id, client_id, clients(business_name, first_name, last_name)")
    .in("status", OPEN_TASK_STATUSES)
    .order("due_at", { ascending: true, nullsFirst: false });
  const staff = await listOrgStaff(ctx.orgId);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const rows = tasks ?? [];

  // Group by client, preserving the due-ordered task order within each group.
  const groups = new Map<string, Group>();
  for (const t of rows) {
    const cid = (t.client_id as string) ?? "none";
    const name = clientName(t.clients as ClientRef | ClientRef[] | null);
    const due = dueLabel(t.due_at as string | null);
    const status = t.status as TaskStatus;
    const ui: UITask = {
      id: t.id as string,
      title: t.title as string,
      status,
      statusLabel: TASK_STATUS_LABEL[status],
      dueText: due.text,
      overdue: due.overdue,
      appointmentId: (t.appointment_id as string | null) ?? null,
      who: t.assignee_id ? (staffName.get(t.assignee_id as string) ?? "Staff") : "Unassigned",
    };
    const g = groups.get(cid) ?? { clientId: cid, name, tasks: [], overdueCount: 0 };
    g.tasks.push(ui);
    if (due.overdue) g.overdueCount += 1;
    groups.set(cid, g);
  }

  // Clients with overdue work first, then most tasks, then name.
  const ordered = [...groups.values()].sort(
    (a, b) => b.overdueCount - a.overdueCount || b.tasks.length - a.tasks.length || a.name.localeCompare(b.name),
  );

  const totalTasks = rows.length;
  const totalOverdue = ordered.reduce((s, g) => s + g.overdueCount, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-xl font-bold text-ink">Preparation tasks</h1>
      <p className="mt-1 text-sm text-muted">
        Open prep grouped by client. {totalTasks} task{totalTasks === 1 ? "" : "s"} across {ordered.length} client{ordered.length === 1 ? "" : "s"}
        {totalOverdue > 0 && <span className="font-semibold text-red-700"> · {totalOverdue} overdue</span>}.
      </p>

      <div className="mt-6 space-y-2.5">
        {ordered.length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">Nothing to prepare right now. 🎉</p>
        ) : (
          ordered.map((g) => (
            <ClientTaskCard key={g.clientId} name={g.name} initials={initials(g.name)} tasks={g.tasks} overdueCount={g.overdueCount} />
          ))
        )}
      </div>
    </div>
  );
}
