// Client Appointments — upcoming visits as time-tracking cards (countdown bar,
// length, fee, what to bring); the 3 most-recent past visits shown, the rest in
// a collapsible dropdown. Read-only; RLS (appointments_own_read) scopes this to
// the client's own rows.
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
  // Past, most-recent first — show the latest few, tuck the rest in a dropdown.
  const past = rows
    .filter((r) => !isUpcoming(r))
    .sort((a, b) => (b.starts_at ? new Date(b.starts_at).getTime() : 0) - (a.starts_at ? new Date(a.starts_at).getTime() : 0));
  const recentPast = past.slice(0, 3);
  const olderPast = past.slice(3);

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

          {/* Past — show the 3 most recent, then a dropdown for everything else */}
          {past.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold text-ink">Recent visits</h2>
              <div className="mt-2 space-y-1.5">
                {recentPast.map((a) => {
                  const fee = fees.get(a.id);
                  return (
                    <Link key={a.id} href={`/dashboard/client/appointments/${a.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm transition hover:border-line-strong">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{a.title || "Appointment"}</span>
                        <span className="block text-xs text-muted">{dateShort(a.starts_at)}</span>
                      </span>
                      <span className="flex flex-none items-center gap-2">
                        {fee && fee.paid > 0 && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">Paid</span>}
                        <span className="text-xs font-semibold text-muted">{CLIENT_STATUS[a.status] ?? a.status}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Everything older — tucked away, clearable */}
              <RequestHistory
                items={olderPast.map((a): HistoryItem => {
                  const status = a.status;
                  const tone: HistoryItem["tone"] = status === "cancelled" || status === "no_show" ? "red" : status === "completed" ? "green" : "grey";
                  return { id: a.id, subject: a.title || "Appointment", dateText: dateShort(a.starts_at), statusLabel: CLIENT_STATUS[status] ?? status, tone };
                })}
                title="Older appointments"
                hrefBase="/dashboard/client/appointments"
                storageKey="rosa:appt-history-cleared"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
