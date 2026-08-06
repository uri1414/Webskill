// Client Appointments — upcoming visits as time-tracking cards (countdown bar,
// length, fee, what to bring), past ones in a collapsible, clearable section.
// Read-only; RLS (appointments_own_read) scopes this to the client's own rows.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { type AppointmentStatus } from "@/lib/appointments";
import { prepFor } from "@/lib/prep";
import { resolveServiceKey } from "@/lib/services";
import { AppointmentCard } from "@/components/AppointmentCard";
import { RequestHistory, type HistoryItem } from "@/components/RequestHistory";

const CLIENT_STATUS: Partial<Record<AppointmentStatus, string>> = {
  requested: "Being scheduled",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
};
const UPCOMING: AppointmentStatus[] = ["requested", "scheduled", "confirmed", "checked_in"];

function dateShort(iso: string | null): string {
  if (!iso) return "Time to be confirmed";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

type Row = { id: string; title: string | null; starts_at: string | null; ends_at: string | null; status: AppointmentStatus; service_key: string | null };

export default async function ClientAppointments() {
  await requireContext();
  const supabase = createClient();

  const { data } = await supabase
    .from("appointments")
    .select("id, title, starts_at, ends_at, status, service_key")
    .order("starts_at", { ascending: true, nullsFirst: true });

  const rows = (data ?? []) as Row[];
  const now = Date.now();
  const isUpcoming = (r: Row) => UPCOMING.includes(r.status) && (!r.starts_at || new Date(r.starts_at).getTime() >= now);
  const upcoming = rows.filter(isUpcoming);
  const past = rows.filter((r) => !isUpcoming(r));

  // The client's own fees (RLS scopes to them), summed per appointment.
  const { data: pays } = await supabase.from("payments").select("appointment_id, amount, status").not("appointment_id", "is", null);
  const fees = new Map<string, { due: number; paid: number }>();
  for (const p of pays ?? []) {
    const key = p.appointment_id as string;
    const cur = fees.get(key) ?? { due: 0, paid: 0 };
    const amt = Number(p.amount ?? 0);
    if (p.status === "pending") cur.due += amt;
    else if (p.status === "paid") cur.paid += amt;
    fees.set(key, cur);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-ink">Your appointments</h1>
        <Link href="/dashboard/client/requests/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
          Request an appointment
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line-strong bg-white px-4 py-10 text-center">
          <p className="text-sm font-medium text-ink">No appointments yet</p>
          <p className="mt-1 text-sm text-muted">Request one and we&apos;ll confirm a time.</p>
        </div>
      ) : (
        <>
          <h2 className="mt-6 text-sm font-semibold text-ink">Upcoming ({upcoming.length})</h2>
          <div className="mt-2 space-y-3">
            {upcoming.length === 0 ? (
              <p className="rounded-xl border border-line bg-white px-4 py-6 text-center text-sm text-muted">No upcoming appointments.</p>
            ) : (
              upcoming.map((a) => {
                const fee = fees.get(a.id) ?? { due: 0, paid: 0 };
                const prep = prepFor(resolveServiceKey(a.service_key, a.title));
                return (
                  <AppointmentCard
                    key={a.id}
                    apptId={a.id}
                    href={`/dashboard/client/appointments/${a.id}`}
                    title={a.title || "Appointment"}
                    statusLabel={CLIENT_STATUS[a.status] ?? a.status}
                    startsAt={a.starts_at}
                    endsAt={a.ends_at}
                    due={fee.due}
                    paid={fee.paid}
                    prep={prep}
                  />
                );
              })
            )}
          </div>

          {/* Past — tucked away, clearable, so history doesn't fill the page */}
          <RequestHistory
            items={past.map((a): HistoryItem => {
              const status = a.status;
              const tone: HistoryItem["tone"] = status === "cancelled" || status === "no_show" ? "red" : status === "completed" ? "green" : "grey";
              return { id: a.id, subject: a.title || "Appointment", dateText: dateShort(a.starts_at), statusLabel: CLIENT_STATUS[status] ?? status, tone };
            })}
            title="Past appointments"
            hrefBase="/dashboard/client/appointments"
            storageKey="rosa:appt-history-cleared"
          />
        </>
      )}
    </div>
  );
}
