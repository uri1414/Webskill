// Client home — one overview of everything that matters to the client: their
// next appointment (with what to bring and what they owe), a clear balance
// banner so they arrive ready to pay, their requests, and the business-
// consultation entry point. Read-only; RLS scopes every query to this client.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { type AppointmentStatus } from "@/lib/appointments";
import { formatMoney } from "@/lib/payments";
import { prepFor } from "@/lib/prep";
import { PrepChecklist } from "@/components/PrepChecklist";

const STATUS_LABEL: Record<string, string> = {
  new: "Received", routed: "Received", in_progress: "In progress",
  waiting_on_client: "Waiting on you", resolved: "Confirmed", closed: "Closed",
  no_action: "Closed", spam: "Closed",
};
const CLIENT_APPT_STATUS: Partial<Record<AppointmentStatus, string>> = {
  requested: "Being scheduled", scheduled: "Scheduled", confirmed: "Confirmed",
  checked_in: "Checked in", completed: "Completed", cancelled: "Cancelled", no_show: "Missed",
};
const UPCOMING: AppointmentStatus[] = ["requested", "scheduled", "confirmed", "checked_in"];

function whenLabel(iso: string | null): string {
  if (!iso) return "Time to be confirmed";
  return new Date(iso).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function ClientHome() {
  const ctx = await requireContext();
  const supabase = createClient();

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", ctx.userId).single();
  const firstName = ((profile?.full_name as string) || (profile?.email as string) || "there").split(" ")[0];

  const { data: appts } = await supabase
    .from("appointments").select("id, title, starts_at, status, service_key")
    .order("starts_at", { ascending: true, nullsFirst: true });
  const { data: reqs } = await supabase
    .from("requests").select("id, subject, status, created_at").order("created_at", { ascending: false });
  const { data: pays } = await supabase.from("payments").select("appointment_id, amount, status");

  const rows = (appts ?? []) as { id: string; title: string | null; starts_at: string | null; status: AppointmentStatus; service_key: string | null }[];
  const requests = reqs ?? [];
  const payments = pays ?? [];

  const totalDue = payments.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const next = rows.find((r) => UPCOMING.includes(r.status)) ?? null;
  const nextDue = next
    ? payments.filter((p) => p.appointment_id === next.id && p.status === "pending").reduce((s, p) => s + Number(p.amount ?? 0), 0)
    : 0;
  const prep = next ? prepFor(next.service_key) : null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-xl font-bold text-ink">Hi {firstName}</h1>

      {/* Balance banner — make it impossible to miss */}
      {totalDue > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-800">Balance due: {formatMoney(totalDue)}</p>
          <p className="mt-0.5 text-sm text-amber-700">Please have payment ready for your appointment.</p>
        </div>
      )}

      {/* Next appointment */}
      <section className="mt-4">
        <h2 className="text-sm font-semibold text-ink">Your next appointment</h2>
        {next ? (
          <div className="mt-2 rounded-xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/dashboard/client/appointments/${next.id}`} className="font-medium text-ink transition hover:text-brand-600">{next.title || "Appointment"}</Link>
              <span className="text-xs font-semibold text-muted">{CLIENT_APPT_STATUS[next.status] ?? next.status}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{whenLabel(next.starts_at)}</p>
            {nextDue > 0 && <p className="mt-1 text-sm font-semibold text-amber-700">Balance due: {formatMoney(nextDue)}</p>}
            {next.starts_at && (
              <a href={`/dashboard/appointments/${next.id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                <span aria-hidden>📅</span> Add to calendar
              </a>
            )}
            {prep && (
              <div className="mt-3 border-t border-line pt-3">
                <PrepChecklist id={next.id} bring={prep.bring} avoid={prep.avoid} note={prep.note} />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2 rounded-xl border border-line bg-white px-4 py-6 text-center">
            <p className="text-sm text-muted">No upcoming appointments.</p>
            <Link href="/dashboard/client/requests/new" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
              Request an appointment
            </Link>
          </div>
        )}
      </section>

      {/* Requests */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Your requests</h2>
          <Link href="/dashboard/client/requests/new" className="text-xs font-semibold text-brand-600">New request</Link>
        </div>
        <div className="mt-2 space-y-2">
          {requests.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-4 py-6 text-center text-sm text-muted">No requests yet.</p>
          ) : requests.map((r) => (
            <Link key={r.id as string} href={`/dashboard/client/requests/${r.id}`}
              className="lift flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 hover:border-brand hover:shadow-card">
              <span className="font-medium text-ink">{(r.subject as string) || "Appointment request"}</span>
              <span className="text-xs font-semibold text-muted">{STATUS_LABEL[r.status as string] ?? (r.status as string)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Start / add a business — always via an in-person consultation first. */}
      <div className="mt-6 rounded-xl border border-line bg-surface-soft p-5">
        <h2 className="font-display text-base font-bold text-ink">Have a business — or want to start one?</h2>
        <p className="mt-1 text-sm text-muted">
          Rosa helps you add an existing business or form a new one, starting with a quick in-person consultation.
        </p>
        <Link href="/dashboard/client/requests/new?service=business_consult"
          className="mt-3 inline-block rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">
          Book a business consultation
        </Link>
      </div>
    </div>
  );
}
