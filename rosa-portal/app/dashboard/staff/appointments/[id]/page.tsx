// Staff Appointment detail — reschedule + status actions + activity timeline.
// The legal actions come from the engine (allowedTransitions), so the UI can
// never offer an illegal move; the engine and RLS still enforce it server-side.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import {
  APPOINTMENT_STATUS_LABEL,
  allowedTransitions,
  type AppointmentStatus,
} from "@/lib/appointments";
import { rescheduleAppointmentAction, setAppointmentStatusAction } from "../actions";

// Friendly verb for each move the engine allows from the current state.
const ACTION_LABEL: Record<AppointmentStatus, string> = {
  requested:  "Reopen",
  scheduled:  "Mark scheduled",
  confirmed:  "Confirm",
  checked_in: "Check in",
  completed:  "Mark complete",
  cancelled:  "Cancel",
  no_show:    "Mark no-show",
};
const DESTRUCTIVE: AppointmentStatus[] = ["cancelled", "no_show"];

const VERB_LABEL: Record<string, string> = {
  status_changed: "Status changed",
  scheduled: "Scheduled",
  rescheduled: "Time updated",
};

type ClientRef = { first_name: string | null; last_name: string | null; business_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "Client";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "Client";
}
function whenLabel(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "No time set";
}
// datetime-local default value from a stored timestamp (wall-clock, consistent
// with how times are entered on convert).
function toLocalInput(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export default async function StaffAppointmentDetail({ params }: { params: { id: string } }) {
  await requireCapability("appointments.read");
  const supabase = createClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, title, starts_at, ends_at, status, client_id, clients(first_name, last_name, business_name)")
    .eq("id", params.id)
    .single();
  if (!appt) return <p className="text-sm text-muted">Appointment not found.</p>;

  const status = appt.status as AppointmentStatus;
  const moves = allowedTransitions(status);

  const { data: rel } = await supabase
    .from("request_relations")
    .select("request_id")
    .eq("entity_type", "appointment")
    .eq("entity_id", params.id)
    .maybeSingle();

  const { data: events } = await supabase
    .from("activity_events")
    .select("verb, from_status, to_status, created_at")
    .eq("entity_type", "appointment")
    .eq("entity_id", params.id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/staff/appointments" className="text-sm text-brand-600">← All appointments</Link>
      <h1 className="mt-2 font-display text-xl font-bold text-ink">{(appt.title as string) || "Appointment"}</h1>
      <span className="mt-2 inline-block rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink">
        {APPOINTMENT_STATUS_LABEL[status] ?? status}
      </span>

      <dl className="mt-4 space-y-2 rounded-xl border border-line bg-white p-4 text-sm">
        <div><dt className="text-xs font-semibold uppercase text-muted">Client</dt><dd className="text-ink">{clientName(appt.clients as ClientRef | ClientRef[] | null)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-muted">When</dt><dd className="text-ink">{whenLabel(appt.starts_at as string | null)}</dd></div>
        {rel?.request_id && (
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">From request</dt>
            <dd><Link href={`/dashboard/staff/requests/${rel.request_id}`} className="font-semibold text-brand-600">View original request →</Link></dd>
          </div>
        )}
      </dl>

      {/* Add to calendar — universal .ics, works with Apple/Google/Outlook */}
      {appt.starts_at && (
        <a
          href={`/dashboard/appointments/${appt.id}`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft"
        >
          <span aria-hidden>📅</span> Add to calendar
        </a>
      )}

      {/* Reschedule / set time */}
      {status !== "completed" && status !== "cancelled" && status !== "no_show" && (
        <form action={rescheduleAppointmentAction} className="mt-5 space-y-3 rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">{appt.starts_at ? "Reschedule" : "Set the appointment time"}</p>
          <input type="hidden" name="appointmentId" value={appt.id as string} />
          <div>
            <label htmlFor="startsAt" className="block text-xs font-semibold text-muted">Date &amp; time</label>
            <input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={toLocalInput(appt.starts_at as string | null)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
          </div>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
            {appt.starts_at ? "Update time" : "Schedule"}
          </button>
        </form>
      )}

      {/* Status actions — only the moves the engine allows from here */}
      {moves.length > 0 && (
        <div className="mt-5 rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Update status</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {moves.map((to) => (
              <form key={to} action={setAppointmentStatusAction}>
                <input type="hidden" name="appointmentId" value={appt.id as string} />
                <input type="hidden" name="status" value={to} />
                <button
                  type="submit"
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    DESTRUCTIVE.includes(to)
                      ? "border border-red-200 text-red-700 hover:bg-red-50"
                      : "border border-line-strong text-ink hover:bg-surface-soft"
                  }`}
                >
                  {ACTION_LABEL[to] ?? to}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-ink">Activity</h2>
        <ol className="mt-2 space-y-1.5 border-l border-line pl-4 text-sm">
          {(events ?? []).map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand" />
              <span className="text-ink">{VERB_LABEL[e.verb as string] ?? (e.verb as string)}</span>
              {e.to_status && <span className="text-muted"> → {APPOINTMENT_STATUS_LABEL[e.to_status as AppointmentStatus] ?? (e.to_status as string)}</span>}
              <span className="ml-2 text-xs text-muted">{new Date(e.created_at as string).toLocaleString()}</span>
            </li>
          ))}
          {(events ?? []).length === 0 && <li className="text-muted">No activity yet.</li>}
        </ol>
      </div>
    </div>
  );
}
