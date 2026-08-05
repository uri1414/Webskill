// Client Appointments — read-only. RLS (appointments_own_read) scopes this to
// the signed-in client's own rows; a client cannot edit an appointment, so
// there are no actions here. To change a time they message staff / submit a
// request (the request flow already exists).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/appointments";

// Client-facing status wording — softer than the internal labels.
const CLIENT_STATUS: Partial<Record<AppointmentStatus, string>> = {
  requested: "Being scheduled",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
};

function whenLabel(iso: string | null): string {
  if (!iso) return "Time to be confirmed";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const UPCOMING: AppointmentStatus[] = ["requested", "scheduled", "confirmed", "checked_in"];

export default async function ClientAppointments() {
  await requireContext();
  const supabase = createClient();

  const { data } = await supabase
    .from("appointments")
    .select("id, title, starts_at, status")
    .order("starts_at", { ascending: true, nullsFirst: true });

  const rows = (data ?? []) as { id: string; title: string | null; starts_at: string | null; status: AppointmentStatus }[];
  const upcoming = rows.filter((r) => UPCOMING.includes(r.status));
  const past = rows.filter((r) => !UPCOMING.includes(r.status));

  const Card = ({ a }: { a: (typeof rows)[number] }) => (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink">{a.title || "Appointment"}</span>
        <span className="text-xs font-semibold text-muted">{CLIENT_STATUS[a.status] ?? a.status}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{whenLabel(a.starts_at)}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-xl font-bold text-ink">Your appointments</h1>
        <Link href="/dashboard/client/requests/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
          Request an appointment
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-white px-4 py-8 text-center text-sm text-muted">
          No appointments yet. Request one and we&apos;ll confirm a time.
        </p>
      ) : (
        <>
          <div className="mt-6 space-y-2">
            {upcoming.length > 0
              ? upcoming.map((a) => <Card key={a.id} a={a} />)
              : <p className="rounded-xl border border-line bg-white px-4 py-6 text-center text-sm text-muted">No upcoming appointments.</p>}
          </div>
          {past.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold text-ink">Past</h2>
              <div className="mt-2 space-y-2 opacity-80">{past.map((a) => <Card key={a.id} a={a} />)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
