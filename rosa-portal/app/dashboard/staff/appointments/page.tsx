// Staff Appointments list. Appointments are created 'requested' when a request
// is converted; this is where staff schedule, confirm, complete, or cancel them.
// RLS scopes to the org + staff; the staff layout guards the whole subtree.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/appointments";

type ClientRef = { first_name: string | null; last_name: string | null; business_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "Client";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "Client";
}

function whenLabel(startsAt: string | null): string {
  if (!startsAt) return "No time set";
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const OPEN: AppointmentStatus[] = ["requested", "scheduled", "confirmed", "checked_in"];

type Row = {
  id: string;
  title: string | null;
  starts_at: string | null;
  status: AppointmentStatus;
  clients: ClientRef | ClientRef[] | null;
};

function statusChip(status: AppointmentStatus): string {
  if (status === "confirmed") return "bg-green-50 text-green-700";
  if (status === "requested") return "bg-amber-50 text-amber-700";
  if (status === "cancelled" || status === "no_show") return "bg-red-50 text-red-700";
  if (status === "completed") return "bg-surface-soft text-muted";
  return "bg-brand-50 text-brand-600";
}

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2 font-semibold">Client</th>
            <th className="px-4 py-2 font-semibold">Appointment</th>
            <th className="px-4 py-2 font-semibold">When</th>
            <th className="px-4 py-2 font-semibold">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-medium text-ink">{clientName(a.clients)}</td>
              <td className="px-4 py-3 text-ink">{a.title || "Appointment"}</td>
              <td className="px-4 py-3 text-muted">{whenLabel(a.starts_at)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusChip(a.status)}`}>
                  {APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/dashboard/staff/appointments/${a.id}`} className="font-semibold text-brand-600">Open →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function StaffAppointments() {
  await requireCapability("appointments.read");
  const supabase = createClient();

  const { data } = await supabase
    .from("appointments")
    .select("id, title, starts_at, status, clients(first_name, last_name, business_name)")
    .order("starts_at", { ascending: true, nullsFirst: true });

  const rows = (data ?? []) as Row[];
  const open = rows.filter((r) => OPEN.includes(r.status));
  const done = rows.filter((r) => !OPEN.includes(r.status));

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-xl font-bold text-ink">Appointments</h1>
        <Link href="/dashboard/staff/appointments/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
          New appointment
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">Schedule, confirm, and complete client appointments.</p>

      <h2 className="mt-6 text-sm font-semibold text-ink">Open ({open.length})</h2>
      <div className="mt-2">
        {open.length === 0
          ? <p className="rounded-xl border border-line bg-white px-4 py-8 text-center text-sm text-muted">No open appointments. Book one, or convert a request.</p>
          : <Table rows={open} />}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-ink">Closed ({done.length})</h2>
          <div className="mt-2"><Table rows={done} /></div>
        </>
      )}
    </div>
  );
}
