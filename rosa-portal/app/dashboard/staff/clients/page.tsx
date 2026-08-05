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
};
function clientName(c: ClientRow): string {
  return c.business_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Client";
}

export default async function StaffClients() {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, first_name, last_name, business_name, email")
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
      <h1 className="font-display text-xl font-bold text-ink">Clients</h1>
      <p className="mt-1 text-sm text-muted">Everyone Rosa &amp; Co. works with. Balance due and no-shows at a glance.</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No clients yet.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-semibold">Client</th>
                <th className="px-4 py-2 font-semibold">Balance due</th>
                <th className="px-4 py-2 font-semibold">No-shows</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const due = dueByClient.get(c.id) ?? 0;
                const noShows = noShowByClient.get(c.id) ?? 0;
                return (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{clientName(c)}</span>
                      {c.email && <span className="block text-xs text-muted">{c.email}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {due > 0
                        ? <span className="font-semibold text-amber-700">{formatMoney(due)}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {noShows > 0
                        ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">⚠︎ {noShows}</span>
                        : <span className="text-muted">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/staff/clients/${c.id}`} className="font-semibold text-brand-600">Open →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
