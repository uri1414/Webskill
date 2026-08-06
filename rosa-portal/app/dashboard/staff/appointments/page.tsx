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

// A friendly, human "when": Today / Tomorrow first, then weekday + time.
function whenLabel(startsAt: string | null): string {
  if (!startsAt) return "No time set";
  const d = new Date(startsAt);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return `Today · ${time}`;
  if (diffDays === 1) return `Tomorrow · ${time}`;
  if (diffDays === -1) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
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
  return "bg-brand-soft text-brand-600"; // scheduled / checked_in
}

// A colored spine on the left of each row — lets staff scan status without
// reading the chip. Muted for closed, saturated for the live states.
function accentBar(status: AppointmentStatus): string {
  if (status === "confirmed") return "bg-green-500";
  if (status === "requested") return "bg-amber-500";
  if (status === "cancelled" || status === "no_show") return "bg-red-400";
  if (status === "completed") return "bg-line-strong";
  return "bg-brand"; // scheduled / checked_in
}

function Row({ a }: { a: Row }) {
  return (
    <Link
      href={`/dashboard/staff/appointments/${a.id}`}
      className="lift group flex items-center gap-3.5 rounded-xl border border-line bg-white px-3.5 py-3 hover:border-brand hover:shadow-card"
    >
      <span aria-hidden className={`h-9 w-1.5 flex-none rounded-full ${accentBar(a.status)}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-ink">{clientName(a.clients)}</p>
          <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChip(a.status)}`}>
            {APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {a.title || "Appointment"} <span className="text-line-strong">·</span> {whenLabel(a.starts_at)}
        </p>
      </div>
      <span
        aria-hidden
        className="flex-none text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
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
        <Link href="/dashboard/staff/appointments/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
          <span aria-hidden className="text-base leading-none">+</span> New appointment
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">Schedule, confirm, and complete client appointments.</p>

      <div className="mt-6 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">Open</h2>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-600">{open.length}</span>
      </div>
      <div className="mt-2.5 space-y-2">
        {open.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">No open appointments</p>
            <p className="mt-1 text-sm text-muted">Book one, or convert a request into an appointment.</p>
            <Link href="/dashboard/staff/appointments/new" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">
              New appointment →
            </Link>
          </div>
        ) : (
          open.map((a) => <Row key={a.id} a={a} />)
        )}
      </div>

      {done.length > 0 && (
        <>
          <div className="mt-8 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">Closed</h2>
            <span className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-semibold text-muted">{done.length}</span>
          </div>
          <div className="mt-2.5 space-y-2 opacity-80">
            {done.map((a) => <Row key={a.id} a={a} />)}
          </div>
        </>
      )}
    </div>
  );
}
