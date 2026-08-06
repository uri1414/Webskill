// Staff home — "what needs attention next." One screen that answers: what's
// waiting, what's today, what's due, and who owes. Pure read of existing data
// (no new tables); each tile links to the surface that acts on it. Directly
// targets the "too much depends on memory" pain and keeps adoption simple.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { serviceLabel } from "@/lib/services";
import { formatMoney } from "@/lib/payments";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/appointments";
import { OPEN_TASK_STATUSES } from "@/lib/tasks";

const OPEN_REQ = ["new", "routed", "in_progress", "waiting_on_client"];
const UPCOMING_APPT = ["requested", "scheduled", "confirmed", "checked_in"];

type ClientRef = { first_name: string | null; last_name: string | null; business_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "Client";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "Client";
}

export default async function StaffHome() {
  const ctx = await requireCapability("clients.read");
  const supabase = createClient();

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", ctx.userId).single();
  const firstName = ((profile?.full_name as string) || (profile?.email as string) || "there").split(" ")[0];

  // Start of today (wall-clock / UTC, matching how times are stored).
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

  const [{ count: reqCount }, { data: reqList }, { data: apptList }, { data: openTasks }, { data: pendingPays }] =
    await Promise.all([
      supabase.from("requests").select("id", { count: "exact", head: true }).in("status", OPEN_REQ),
      supabase.from("requests").select("id, subject, category_key, created_at").in("status", OPEN_REQ).order("created_at", { ascending: false }).limit(5),
      supabase.from("appointments").select("id, title, starts_at, status, clients(first_name, last_name, business_name)").gte("starts_at", startOfToday).in("status", UPCOMING_APPT).order("starts_at", { ascending: true }).limit(5),
      supabase.from("tasks").select("id, title, due_at, appointment_id").in("status", OPEN_TASK_STATUSES).order("due_at", { ascending: true, nullsFirst: false }).limit(6),
      supabase.from("payments").select("amount, client_id").eq("status", "pending"),
    ]);

  const requests = reqList ?? [];
  const appts = apptList ?? [];
  const tasks = openTasks ?? [];
  const pays = pendingPays ?? [];

  const balanceDue = pays.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const clientsOwing = new Set(pays.map((p) => p.client_id as string)).size;
  const overdueTasks = tasks.filter((t) => t.due_at && new Date(t.due_at as string).getTime() < now.getTime()).length;

  const Tile = ({ href, value, label, tone }: { href: string; value: string | number; label: string; tone?: "warn" | "ok" }) => (
    <Link href={href} className="rounded-xl border border-line bg-white p-4 shadow-card transition hover:border-line-strong">
      <div className={`font-display text-2xl font-bold ${tone === "warn" ? "text-amber-700" : "text-ink"}`}>{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-muted">{label}</div>
    </Link>
  );

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-ink">Welcome back, {firstName}</h1>
      <p className="mt-1 text-sm text-muted">Here&apos;s what needs your attention.</p>

      {/* At-a-glance */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile href="/dashboard/staff/requests" value={reqCount ?? 0} label="Open requests" tone={reqCount ? "warn" : undefined} />
        <Tile href="/dashboard/staff/appointments" value={appts.length} label="Upcoming appts" />
        <Tile href="/dashboard/staff/tasks" value={overdueTasks > 0 ? `${overdueTasks} overdue` : tasks.length} label="Prep tasks" tone={overdueTasks ? "warn" : undefined} />
        <Tile href="/dashboard/staff/clients" value={formatMoney(balanceDue)} label={clientsOwing ? `Due · ${clientsOwing} client${clientsOwing > 1 ? "s" : ""}` : "Nothing due"} tone={balanceDue ? "warn" : undefined} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* New requests */}
        <section className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Requests to handle</h2>
            <Link href="/dashboard/staff/requests" className="text-xs font-semibold text-brand-600">All →</Link>
          </div>
          <div className="mt-2 space-y-1.5">
            {requests.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">All caught up.</p>
            ) : requests.map((r) => (
              <Link key={r.id as string} href={`/dashboard/staff/requests/${r.id}`} className="block rounded-lg border border-line px-3 py-2 text-sm transition hover:bg-surface-soft">
                <span className="font-medium text-ink">{serviceLabel(r.category_key as string)}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Upcoming appointments */}
        <section className="rounded-xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Upcoming appointments</h2>
            <Link href="/dashboard/staff/appointments" className="text-xs font-semibold text-brand-600">All →</Link>
          </div>
          <div className="mt-2 space-y-1.5">
            {appts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nothing scheduled.</p>
            ) : appts.map((a) => (
              <Link key={a.id as string} href={`/dashboard/staff/appointments/${a.id}`} className="block rounded-lg border border-line px-3 py-2 text-sm transition hover:bg-surface-soft">
                <span className="font-medium text-ink">{clientName(a.clients as ClientRef | ClientRef[] | null)}</span>
                <span className="block text-xs text-muted">
                  {a.starts_at ? new Date(a.starts_at as string).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No time set"}
                  {" · "}{APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus] ?? (a.status as string)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Prep due */}
      <section className="mt-4 rounded-xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Preparation due</h2>
          <Link href="/dashboard/staff/tasks" className="text-xs font-semibold text-brand-600">All tasks →</Link>
        </div>
        <div className="mt-2 space-y-1.5">
          {tasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Nothing to prepare right now.</p>
          ) : tasks.map((t) => {
            const overdue = t.due_at && new Date(t.due_at as string).getTime() < now.getTime();
            const href = t.appointment_id ? `/dashboard/staff/appointments/${t.appointment_id}` : "/dashboard/staff/tasks";
            return (
              <Link key={t.id as string} href={href} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm transition hover:bg-surface-soft">
                <span className="font-medium text-ink">{t.title as string}</span>
                <span className={`text-xs font-semibold ${overdue ? "text-red-700" : "text-muted"}`}>
                  {t.due_at ? `${overdue ? "Overdue" : "Due"} ${new Date(t.due_at as string).toLocaleDateString()}` : "No due date"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
