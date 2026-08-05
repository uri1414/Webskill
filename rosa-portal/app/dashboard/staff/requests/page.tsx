// Screen 2: Staff Request Queue. Shows client name, selected service, timing
// preference, and status. RLS scopes to the org + staff; the layout guards it.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { serviceLabel } from "@/lib/services";

const OPEN = ["new", "routed", "in_progress", "waiting_on_client"];

type ClientRef = { first_name: string | null; last_name: string | null; business_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "Client";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "Client";
}
function timing(date: string | null, time: string | null): string {
  const parts = [date, time].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default async function StaffRequestQueue() {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: requests } = await supabase
    .from("requests")
    .select("id, category_key, status, preferred_date, preferred_time, assigned_user_id, created_at, clients(first_name, last_name, business_name)")
    .in("status", OPEN)
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-ink">Requests</h1>
      <p className="mt-1 text-sm text-muted">Open client requests. Claim one to start working it.</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        {(requests ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No open requests.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-semibold">Client</th>
                <th className="px-4 py-2 font-semibold">Service</th>
                <th className="px-4 py-2 font-semibold">Preferred</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(requests ?? []).map((r) => (
                <tr key={r.id as string} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{clientName(r.clients as ClientRef | ClientRef[] | null)}</td>
                  <td className="px-4 py-3 text-ink">{serviceLabel(r.category_key as string)}</td>
                  <td className="px-4 py-3 text-muted">{timing(r.preferred_date as string | null, r.preferred_time as string | null)}</td>
                  <td className="px-4 py-3 text-muted">{r.status as string}{r.assigned_user_id ? " · claimed" : ""}</td>
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
