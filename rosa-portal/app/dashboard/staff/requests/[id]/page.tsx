// Staff request detail — Rosa's one-step approve. She reviews the request and
// confirms it as an appointment in a single action (title + time pre-filled
// from what the client asked for, editable), or declines it. The old
// claim → convert → schedule → confirm chain is collapsed into this.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { serviceLabel } from "@/lib/services";
import { confirmAppointmentAction, declineRequestAction } from "../actions";

const VERB_LABEL: Record<string, string> = {
  created: "Request created",
  routed: "Routed to staff",
  status_changed: "Status changed",
  converted: "Confirmed as appointment",
};

// Requests still awaiting a decision.
const OPEN = ["new", "routed", "in_progress", "waiting_on_client"];

// Turn the client's rough time preference into a sensible default hour so the
// admin usually only has to glance at it, not retype it.
const PREF_HOUR: Record<string, string> = { Morning: "09:00", Midday: "12:00", Afternoon: "14:00" };

export default async function StaffRequestDetail({ params }: { params: { id: string } }) {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("id, subject, body, status, resolution, category_key, client_id, preferred_date, preferred_time")
    .eq("id", params.id)
    .single();
  if (!request) return <p className="text-sm text-muted">Request not found.</p>;

  const status = request.status as string;
  const category = request.category_key as string;
  const isOther = category === "other";
  const preferred = [request.preferred_date, request.preferred_time].filter(Boolean).join(" · ");
  const defaultTitle = (request.subject as string) || serviceLabel(category);

  const prefHour = PREF_HOUR[(request.preferred_time as string) ?? ""] ?? "09:00";
  const prefillDateTime = request.preferred_date ? `${request.preferred_date}T${prefHour}` : undefined;

  const { data: rel } = await supabase
    .from("request_relations")
    .select("entity_id")
    .eq("request_id", params.id)
    .eq("entity_type", "appointment")
    .maybeSingle();

  const { data: events } = await supabase
    .from("activity_events")
    .select("verb, from_status, to_status, created_at")
    .eq("entity_type", "request")
    .eq("entity_id", params.id)
    .order("created_at", { ascending: true });

  const isOpen = OPEN.includes(status);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/staff/requests" className="text-sm text-brand-600">← All requests</Link>
      <h1 className="mt-2 font-display text-xl font-bold text-ink">{serviceLabel(category)}</h1>
      <span className="mt-2 inline-block rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink">{status}</span>

      {/* Request details */}
      <dl className="mt-4 space-y-2 rounded-xl border border-line bg-white p-4 text-sm">
        {isOther && (
          <div><dt className="text-xs font-semibold uppercase text-muted">Client described</dt><dd className="text-ink">{request.subject as string}</dd></div>
        )}
        <div><dt className="text-xs font-semibold uppercase text-muted">Preferred timing</dt><dd className="text-ink">{preferred || "No preference"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-muted">Note</dt><dd className="text-ink">{(request.body as string) || "—"}</dd></div>
      </dl>

      {/* One-step approve: confirm this request as an appointment */}
      {isOpen && (
        <div className="mt-5 space-y-3">
          <form action={confirmAppointmentAction} className="space-y-3 rounded-xl border border-line bg-white p-4">
            <p className="text-sm font-semibold text-ink">Confirm this appointment</p>
            <input type="hidden" name="requestId" value={request.id as string} />
            <input type="hidden" name="clientId" value={request.client_id as string} />
            <div>
              <label htmlFor="title" className="block text-xs font-semibold text-muted">Title</label>
              <input id="title" name="title" defaultValue={defaultTitle}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
            </div>
            <div>
              <label htmlFor="startsAt" className="block text-xs font-semibold text-muted">
                Date &amp; time {preferred && <span className="font-normal">— client prefers {preferred}</span>}
              </label>
              <input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={prefillDateTime}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
            </div>
            <div>
              <label htmlFor="fee" className="block text-xs font-semibold text-muted">
                Service fee <span className="font-normal">(optional — leave blank if free)</span>
              </label>
              <div className="mt-1 flex items-center rounded-lg border border-line pl-3 focus-within:border-brand">
                <span className="text-sm text-muted">$</span>
                <input id="fee" name="fee" type="number" min="0" step="0.01" inputMode="decimal" placeholder="150.00"
                  className="w-full rounded-lg px-2 py-2 text-sm text-ink outline-none" />
              </div>
            </div>
            <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
              Confirm appointment
            </button>
            <p className="text-xs text-muted">Books it and notifies the client. If you set a fee, they&apos;ll see a balance due.</p>
          </form>

          <form action={declineRequestAction}>
            <input type="hidden" name="requestId" value={request.id as string} />
            <button type="submit" className="text-sm font-semibold text-red-700 transition hover:underline">
              Decline request
            </button>
          </form>
        </div>
      )}

      {/* Confirmed */}
      {status === "resolved" && (
        <div className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
          <p className="font-semibold text-ink">Confirmed as an appointment.</p>
          {rel?.entity_id && (
            <Link href={`/dashboard/staff/appointments/${rel.entity_id}`} className="mt-1 inline-block font-semibold text-brand-600">
              Open the appointment →
            </Link>
          )}
          <p className="mt-1 text-muted">The client has been notified in-portal.</p>
        </div>
      )}

      {/* Declined */}
      {(status === "no_action" || status === "spam") && (
        <div className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
          <p className="font-semibold text-ink">Request declined.</p>
          <p className="mt-1 text-muted">No appointment was created.</p>
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
              {e.to_status && <span className="text-muted"> → {e.to_status as string}</span>}
              <span className="ml-2 text-xs text-muted">{new Date(e.created_at as string).toLocaleString()}</span>
            </li>
          ))}
          {(events ?? []).length === 0 && <li className="text-muted">No activity yet.</li>}
        </ol>
      </div>
    </div>
  );
}
