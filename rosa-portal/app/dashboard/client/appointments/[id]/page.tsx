// Client appointment detail — the one place a client sees everything about a
// visit and knows what to do next: when it is, its status, what to bring, what
// they owe, and how to add it to their calendar. Read-only; RLS scopes it to
// the client's own appointment + own payments. Robust to pending migrations —
// service_key is fetched separately so "what to bring" simply hides if the
// column isn't there yet.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { type AppointmentStatus } from "@/lib/appointments";
import { formatMoney } from "@/lib/payments";
import { prepFor } from "@/lib/prep";
import { resolveServiceKey } from "@/lib/services";
import { PrepChecklist } from "@/components/PrepChecklist";

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

export default async function ClientAppointmentDetail({ params }: { params: { id: string } }) {
  await requireContext();
  const supabase = createClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, title, starts_at, status")
    .eq("id", params.id)
    .single();
  if (!appt) return <p className="text-sm text-muted">Appointment not found.</p>;

  const status = appt.status as AppointmentStatus;

  // Fetched separately so a missing service_key column (pre-migration) can't
  // break the page — "what to bring" just won't show.
  const { data: svc } = await supabase.from("appointments").select("service_key").eq("id", params.id).maybeSingle();
  const serviceKey = resolveServiceKey((svc?.service_key as string | null) ?? null, appt.title as string | null);
  const prep = prepFor(serviceKey);

  const { data: pays } = await supabase
    .from("payments").select("amount, status").eq("appointment_id", params.id);
  const due = (pays ?? []).filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const paid = (pays ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const showCalendar = !!appt.starts_at && status !== "cancelled";

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/dashboard/client/appointments" className="text-sm text-brand-600">← My appointments</Link>
      <h1 className="mt-2 font-display text-xl font-bold text-ink">{(appt.title as string) || "Appointment"}</h1>
      <span className="mt-2 inline-block rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink">
        {CLIENT_STATUS[status] ?? status}
      </span>

      <dl className="mt-4 space-y-2 rounded-xl border border-line bg-white p-4 text-sm">
        <div><dt className="text-xs font-semibold uppercase text-muted">When</dt><dd className="text-ink">{whenLabel(appt.starts_at as string | null)}</dd></div>
        {paid > 0 && due === 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Payment</dt>
            <dd className="font-semibold text-green-700">Paid {formatMoney(paid)}</dd>
          </div>
        )}
      </dl>

      {showCalendar && (
        <a href={`/dashboard/appointments/${appt.id}`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">
          <span aria-hidden>📅</span> Add to calendar
        </a>
      )}

      {due > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-800">Balance due: {formatMoney(due)}</p>
          <p className="mt-0.5 text-sm text-amber-700">Please have payment ready for your appointment.</p>
        </div>
      )}

      {prep && status !== "cancelled" && (
        <div className="mt-5 rounded-xl border border-line bg-white p-4">
          <PrepChecklist id={appt.id as string} bring={prep.bring} avoid={prep.avoid} note={prep.note} />
        </div>
      )}
    </div>
  );
}
