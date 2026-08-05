// Screens 3 & 4: staff request detail — Claim + Convert. Shows the selected
// service, timing preference, the client's note, the activity timeline, and the
// legal action for the current state. Convert carries the request info forward.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { serviceLabel } from "@/lib/services";
import { claimRequestAction, convertToAppointmentAction } from "../actions";

const VERB_LABEL: Record<string, string> = {
  created: "Request created",
  routed: "Routed to staff",
  status_changed: "Status changed",
  converted: "Converted to appointment",
};

export default async function StaffRequestDetail({ params }: { params: { id: string } }) {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("id, subject, body, status, resolution, category_key, client_id, assigned_user_id, preferred_date, preferred_time")
    .eq("id", params.id)
    .single();
  if (!request) return <p className="text-sm text-muted">Request not found.</p>;

  const status = request.status as string;
  const category = request.category_key as string;
  const isOther = category === "other";
  const preferred = [request.preferred_date, request.preferred_time].filter(Boolean).join(" · ");
  const defaultTitle = (request.subject as string) || serviceLabel(category);

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

  const prefillDateTime = request.preferred_date ? `${request.preferred_date}T09:00` : undefined;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/staff/requests" className="text-sm text-brand-600">← All requests</Link>
      <h1 className="mt-2 font-display text-xl font-bold text-ink">{serviceLabel(category)}</h1>
      <span className="mt-2 inline-block rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink">{status}</span>

      <dl className="mt-4 space-y-2 rounded-xl border border-line bg-white p-4 text-sm">
        {isOther && (
          <div><dt className="text-xs font-semibold uppercase text-muted">Client described</dt><dd className="text-ink">{request.subject as string}</dd></div>
        )}
        <div><dt className="text-xs font-semibold uppercase text-muted">Preferred timing</dt><dd className="text-ink">{preferred || "No preference"}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-muted">Note</dt><dd className="text-ink">{(request.body as string) || "—"}</dd></div>
      </dl>

      {(status === "routed" || status === "new") && (
        <form action={claimRequestAction} className="mt-5">
          <input type="hidden" name="requestId" value={request.id as string} />
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
            Claim request
          </button>
        </form>
      )}

      {status === "in_progress" && (
        <form action={convertToAppointmentAction} className="mt-5 space-y-3 rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Create the appointment</p>
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
            <input id="startsAt" name="startsAt" type="datetime-local" defaultValue={prefillDateTime}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
          </div>
          {request.body && <p className="text-xs text-muted">Client note: {request.body as string}</p>}
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
            Create appointment &amp; confirm
          </button>
        </form>
      )}

      {status === "resolved" && (
        <div className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
          <p className="font-semibold text-ink">Converted to an appointment.</p>
          {rel?.entity_id && <p className="mt-1 text-muted">Appointment id: {rel.entity_id as string}</p>}
          <p className="mt-1 text-muted">The client has been notified in-portal.</p>
        </div>
      )}

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
