// Client Appointments — read-only. RLS (appointments_own_read) scopes this to
// the signed-in client's own rows; a client cannot edit an appointment, so
// there are no actions here. To change a time they message staff / submit a
// request (the request flow already exists).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { type AppointmentStatus } from "@/lib/appointments";
import { formatMoney } from "@/lib/payments";
import { prepFor } from "@/lib/prep";

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
    .select("id, title, starts_at, status, service_key")
    .order("starts_at", { ascending: true, nullsFirst: true });

  const rows = (data ?? []) as { id: string; title: string | null; starts_at: string | null; status: AppointmentStatus; service_key: string | null }[];
  const upcoming = rows.filter((r) => UPCOMING.includes(r.status));
  const past = rows.filter((r) => !UPCOMING.includes(r.status));

  // The client's own fees (RLS scopes to them), summed per appointment.
  const { data: pays } = await supabase
    .from("payments")
    .select("appointment_id, amount, status")
    .not("appointment_id", "is", null);
  const fees = new Map<string, { due: number; paid: number }>();
  for (const p of pays ?? []) {
    const key = p.appointment_id as string;
    const cur = fees.get(key) ?? { due: 0, paid: 0 };
    const amt = Number(p.amount ?? 0);
    if (p.status === "pending") cur.due += amt;
    else if (p.status === "paid") cur.paid += amt;
    fees.set(key, cur);
  }

  // The whole card is tappable: the title link is stretched over the box with
  // an absolute overlay, and the nested controls (calendar, prep) sit above it
  // (relative z-10) so they stay independently clickable — no nested anchors.
  const Card = ({ a }: { a: (typeof rows)[number] }) => (
    <div className="relative rounded-xl border border-line bg-white px-4 py-3 transition hover:border-brand hover:shadow-card">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/dashboard/client/appointments/${a.id}`}
          className="font-medium text-ink transition after:absolute after:inset-0 hover:text-brand-600"
        >
          {a.title || "Appointment"}
        </Link>
        <span className="text-xs font-semibold text-muted">{CLIENT_STATUS[a.status] ?? a.status}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{whenLabel(a.starts_at)}</p>
      {(() => {
        const f = fees.get(a.id);
        if (f && f.due > 0) return <p className="mt-1 text-sm font-semibold text-amber-700">Balance due: {formatMoney(f.due)}</p>;
        if (f && f.paid > 0) return <p className="mt-1 text-sm font-semibold text-green-700">Paid {formatMoney(f.paid)}</p>;
        return null;
      })()}
      {a.starts_at && a.status !== "cancelled" && (
        <a
          href={`/dashboard/appointments/${a.id}`}
          className="relative z-10 mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600"
        >
          <span aria-hidden>📅</span> Add to calendar
        </a>
      )}
      {(() => {
        const prep = prepFor(a.service_key);
        if (!prep || a.status === "cancelled") return null;
        return (
          <details className="relative z-10 mt-2 border-t border-line pt-2">
            <summary className="cursor-pointer text-sm font-semibold text-brand-600">What to bring</summary>
            <ul className="mt-2 space-y-1">
              {prep.bring.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink"><span aria-hidden className="text-green-700">✓</span>{b}</li>
              ))}
            </ul>
            {prep.avoid && prep.avoid.length > 0 && (
              <ul className="mt-2 space-y-1">
                {prep.avoid.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted"><span aria-hidden className="text-red-600">✕</span>{b}</li>
                ))}
              </ul>
            )}
            {prep.note && <p className="mt-2 text-xs text-muted">{prep.note}</p>}
          </details>
        );
      })()}
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
