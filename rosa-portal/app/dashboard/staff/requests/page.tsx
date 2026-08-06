// Screen 2: Staff Request Queue. Shows client name, selected service, timing
// preference, and status. RLS scopes to the org + staff; the layout guards it.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { serviceLabel } from "@/lib/services";

const OPEN = ["new", "routed", "in_progress", "waiting_on_client"];

// Client-scan colors for the left spine + status chip.
const STATUS_META: Record<string, { label: string; chip: string; bar: string }> = {
  new: { label: "New", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  routed: { label: "Ready to claim", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" },
  in_progress: { label: "In progress", chip: "bg-brand-soft text-brand-600", bar: "bg-brand" },
  waiting_on_client: { label: "Waiting on client", chip: "bg-surface-soft text-muted", bar: "bg-line-strong" },
};

type ClientRef = { first_name: string | null; last_name: string | null; business_name: string | null };
function clientName(c: ClientRef | ClientRef[] | null): string {
  const cc = Array.isArray(c) ? c[0] : c;
  if (!cc) return "Client";
  return cc.business_name || [cc.first_name, cc.last_name].filter(Boolean).join(" ") || "Client";
}
function timing(date: string | null, time: string | null): string {
  const parts = [date, time].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No time preference";
}

export default async function StaffRequestQueue() {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: requests } = await supabase
    .from("requests")
    .select("id, category_key, status, preferred_date, preferred_time, assigned_user_id, created_at, clients(first_name, last_name, business_name)")
    .in("status", OPEN)
    .order("created_at", { ascending: true });

  const rows = requests ?? [];

  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="font-display text-xl font-bold text-ink">Requests</h1>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-600">{rows.length}</span>
      </div>
      <p className="mt-1 text-sm text-muted">Open client requests. Claim one to start working it.</p>

      <div className="mt-6 space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">No open requests</p>
            <p className="mt-1 text-sm text-muted">You&apos;re all caught up. New requests will appear here.</p>
          </div>
        ) : (
          rows.map((r) => {
            const meta = STATUS_META[r.status as string] ?? { label: r.status as string, chip: "bg-surface-soft text-muted", bar: "bg-line-strong" };
            const claimed = !!r.assigned_user_id;
            return (
              <Link
                key={r.id as string}
                href={`/dashboard/staff/requests/${r.id}`}
                className="lift group flex items-center gap-3.5 rounded-xl border border-line bg-white px-3.5 py-3 hover:border-brand hover:shadow-card"
              >
                <span aria-hidden className={`h-9 w-1.5 flex-none rounded-full ${meta.bar}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-ink">{clientName(r.clients as ClientRef | ClientRef[] | null)}</p>
                    <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>{meta.label}</span>
                    {claimed && <span className="flex-none rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-semibold text-muted">Claimed</span>}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {serviceLabel(r.category_key as string)} <span className="text-line-strong">·</span> {timing(r.preferred_date as string | null, r.preferred_time as string | null)}
                  </p>
                </div>
                <span aria-hidden className="flex-none text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
