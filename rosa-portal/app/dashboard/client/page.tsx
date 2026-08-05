import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";

const STATUS_LABEL: Record<string, string> = {
  new: "Received", routed: "Received", in_progress: "In progress",
  waiting_on_client: "Waiting on you", resolved: "Confirmed", closed: "Closed",
};

// Client home: their own requests (RLS-scoped) + a CTA to submit a new one.
export default async function ClientHome() {
  await requireContext();
  const supabase = createClient();
  const { data: requests } = await supabase
    .from("requests")
    .select("id, subject, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-xl font-bold text-ink">Your requests</h1>
        <Link href="/dashboard/client/requests/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
          Request an appointment
        </Link>
      </div>

      <div className="mt-6 space-y-2">
        {(requests ?? []).length === 0 ? (
          <p className="rounded-xl border border-line bg-white px-4 py-8 text-center text-sm text-muted">
            No requests yet. Tap &ldquo;Request an appointment&rdquo; to get started.
          </p>
        ) : (
          (requests ?? []).map((r) => (
            <Link
              key={r.id as string}
              href={`/dashboard/client/requests/${r.id}`}
              className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 transition hover:border-line-strong"
            >
              <span className="font-medium text-ink">{(r.subject as string) || "Appointment request"}</span>
              <span className="text-xs font-semibold text-muted">{STATUS_LABEL[r.status as string] ?? (r.status as string)}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
