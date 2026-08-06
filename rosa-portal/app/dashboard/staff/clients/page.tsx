// Staff Clients list — every client at a glance, with the two things Rosa wants
// to see instantly: who owes money (outstanding balance) and who's a repeat
// no-show. All read-only, org- and staff-scoped by RLS; aggregated in memory
// (one small practice — a handful of queries beats N per row).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { formatMoney } from "@/lib/payments";

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  email: string | null;
  client_type: string | null;
};
function clientName(c: ClientRow): string {
  return c.business_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Client";
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}

export default async function StaffClients() {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, first_name, last_name, business_name, email, client_type")
    .order("created_at", { ascending: false });
  const { data: payments } = await supabase.from("payments").select("client_id, amount, status");
  const { data: appts } = await supabase.from("appointments").select("client_id, status");

  const dueByClient = new Map<string, number>();
  for (const p of payments ?? []) {
    if (p.status === "pending") {
      const k = p.client_id as string;
      dueByClient.set(k, (dueByClient.get(k) ?? 0) + Number(p.amount ?? 0));
    }
  }
  const noShowByClient = new Map<string, number>();
  for (const a of appts ?? []) {
    if (a.status === "no_show") {
      const k = a.client_id as string;
      noShowByClient.set(k, (noShowByClient.get(k) ?? 0) + 1);
    }
  }

  const rows = (clients ?? []) as ClientRow[];

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-bold text-ink">Clients</h1>
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-600">{rows.length}</span>
        </div>
        <Link href="/dashboard/staff/clients/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
          <span aria-hidden className="text-base leading-none">+</span> New client
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">Everyone Rosa &amp; Co. works with. Balance due and no-shows at a glance.</p>

      <div className="mt-6 space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">No clients yet</p>
            <p className="mt-1 text-sm text-muted">Add your first client to get started.</p>
            <Link href="/dashboard/staff/clients/new" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline">New client →</Link>
          </div>
        ) : (
          rows.map((c) => {
            const name = clientName(c);
            const due = dueByClient.get(c.id) ?? 0;
            const noShows = noShowByClient.get(c.id) ?? 0;
            return (
              <Link
                key={c.id}
                href={`/dashboard/staff/clients/${c.id}`}
                className="lift group flex items-center gap-3.5 rounded-xl border border-line bg-white px-3.5 py-3 hover:border-brand hover:shadow-card"
              >
                <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-600">
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-ink">{name}</p>
                    {c.client_type === "business" && (
                      <span className="flex-none rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">🏢 Business</span>
                    )}
                  </div>
                  {c.email && <p className="truncate text-xs text-muted">{c.email}</p>}
                </div>
                <div className="flex flex-none items-center gap-2">
                  {noShows > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">⚠︎ {noShows} no-show{noShows > 1 ? "s" : ""}</span>
                  )}
                  {due > 0 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{formatMoney(due)} due</span>
                  )}
                  <span aria-hidden className="text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
