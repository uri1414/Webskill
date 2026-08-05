// app/dashboard/client/requests/[id]/page.tsx — Screen 5: Client Confirmation.
// A read-only view across Request + relation + Appointment. RLS guarantees the
// client only ever sees their own. No writes, no logic.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";

const STATUS_LABEL: Record<string, string> = {
  new: "Received", routed: "Received", in_progress: "In progress",
  waiting_on_client: "Waiting on you", resolved: "Confirmed", closed: "Closed",
};

export default async function ClientRequestPage({ params }: { params: { id: string } }) {
  await requireContext();
  const supabase = createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("id, subject, body, status, resolution, created_at")
    .eq("id", params.id)
    .single();
  if (!request) return <p className="text-sm text-muted">Request not found.</p>;

  const { data: rel } = await supabase
    .from("request_relations")
    .select("entity_id")
    .eq("request_id", params.id)
    .eq("entity_type", "appointment")
    .maybeSingle();

  let appointment: { id: string; title: string | null; status: string; starts_at: string | null } | null = null;
  if (rel?.entity_id) {
    const { data } = await supabase
      .from("appointments")
      .select("id, title, status, starts_at")
      .eq("id", rel.entity_id)
      .single();
    appointment = data as typeof appointment;
  }

  const confirmed = request.status === "resolved" && request.resolution === "converted";

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/dashboard/client" className="text-sm text-brand-600">← Dashboard</Link>
      <h1 className="mt-2 font-display text-xl font-bold text-ink">{request.subject || "Appointment request"}</h1>
      <span className="mt-2 inline-block rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink">
        {STATUS_LABEL[request.status] ?? request.status}
      </span>

      {request.body && <p className="mt-4 text-sm text-muted">{request.body}</p>}

      {confirmed && appointment ? (
        <div className="mt-6 rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Your appointment is set</p>
          <p className="mt-1 text-sm text-ink">{appointment.title || "Appointment"}</p>
          {appointment.starts_at && (
            <p className="mt-0.5 text-sm text-muted">{new Date(appointment.starts_at).toLocaleString()}</p>
          )}
          <p className="mt-2 text-xs text-muted">Status: {appointment.status}</p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">We&apos;ve received your request. You&apos;ll see your appointment here once our team confirms it — no need to check your email.</p>
      )}
    </div>
  );
}
