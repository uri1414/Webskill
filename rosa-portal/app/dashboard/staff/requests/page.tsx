// Screen 2: Staff Request Queue. Read-only list of the org's open requests,
// oldest first. RLS scopes to the org + staff; the layout guard gates access.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";

const OPEN = ["new", "routed", "in_progress", "waiting_on_client"];

export default async function StaffRequestQueue() {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: requests } = await supabase
    .from("requests")
    .select("id, subject, status, priority, assigned_user_id, created_at")
    .in("status", OPEN)
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-ink">Requests</h1>
      <p className="mt-1 text-sm text-muted">Open client requests. Claim one to start working it.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
        {(requests ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No open requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-semibold">Subject</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Owner</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(requests ?? []).map((r) => (
                <tr key={r.id as string} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{(r.subject as string) || "Appointment request"}</td>
                  <td className="px-4 py-3 text-muted">{r.status as string}</td>
                  <td className="px-4 py-3 text-muted">{r.assigned_user_id ? "Claimed" : "Unclaimed"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/staff/requests/${r.id}`} className="font-semibold text-brand-600">Open →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
