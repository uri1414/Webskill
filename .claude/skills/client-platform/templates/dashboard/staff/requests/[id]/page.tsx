// app/dashboard/staff/requests/[id]/page.tsx — Screens 3 & 4: Claim + Convert.
// Read the request, then show the ONE action legal for its current state:
//   routed        -> Claim        (claimRequestAction)
//   in_progress   -> Convert      (convertToAppointmentAction)
//   resolved      -> show the linked appointment
// The forms post to server actions; this component holds no lifecycle logic.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { claimRequestAction, convertToAppointmentAction } from "../actions";

export default async function StaffRequestDetail({ params }: { params: { id: string } }) {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("id, subject, body, status, resolution, priority, client_id, assigned_user_id")
    .eq("id", params.id)
    .single();
  if (!request) return <p className="text-sm text-muted">Request not found.</p>;

  const status = request.status as string;

  const { data: rel } = await supabase
    .from("request_relations")
    .select("entity_id")
    .eq("request_id", params.id)
    .eq("entity_type", "appointment")
    .maybeSingle();

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard/staff/requests" className="text-sm text-brand-600">← All requests</Link>
      <h1 className="mt-2 font-display text-xl font-bold text-ink">{(request.subject as string) || "Appointment request"}</h1>
      <span className="mt-2 inline-block rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink">{status}</span>
      {request.body && <p className="mt-4 text-sm text-muted">{request.body as string}</p>}

      {/* Screen 3 — Claim (only when routed/new and unclaimed) */}
      {(status === "routed" || status === "new") && (
        <form action={claimRequestAction} className="mt-6">
          <input type="hidden" name="requestId" value={request.id as string} />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
            Claim request
          </button>
        </form>
      )}

      {/* Screen 4 — Convert to appointment (once in progress) */}
      {status === "in_progress" && (
        <form action={convertToAppointmentAction} className="mt-6 space-y-3 rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Create the appointment</p>
          <input type="hidden" name="requestId" value={request.id as string} />
          <input type="hidden" name="clientId" value={request.client_id as string} />
          <div>
            <label htmlFor="title" className="block text-xs font-semibold text-muted">Title</label>
            <input id="title" name="title" defaultValue={(request.subject as string) || "Appointment"}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand-600" />
          </div>
          <div>
            <label htmlFor="startsAt" className="block text-xs font-semibold text-muted">Date &amp; time</label>
            <input id="startsAt" name="startsAt" type="datetime-local"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand-600" />
          </div>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
            Create appointment &amp; confirm
          </button>
        </form>
      )}

      {/* Resolved — the loop is complete */}
      {status === "resolved" && (
        <div className="mt-6 rounded-xl border border-line bg-white p-4 text-sm">
          <p className="font-semibold text-ink">Converted to an appointment.</p>
          {rel?.entity_id && <p className="mt-1 text-muted">Appointment id: {rel.entity_id as string}</p>}
          <p className="mt-1 text-muted">The client has been notified in-portal.</p>
        </div>
      )}
    </div>
  );
}
