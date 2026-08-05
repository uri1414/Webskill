// Staff Client profile — the whole relationship in one place. Contact, money
// (paid vs. due, incl. cancellation/no-show fees), full appointment & request
// history, plus "Services provided" (what they've used) and "Services you could
// offer" (the menu minus what they've used — a ready-made upsell list). All
// read-only, derived from existing data; no new tables.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { SERVICES, serviceLabel } from "@/lib/services";
import { formatMoney, PAYMENT_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/payments";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/appointments";

function whenLabel(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "No time set";
}
function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function ClientProfile({ params }: { params: { id: string } }) {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, business_name, email, phone, status, created_at")
    .eq("id", params.id)
    .single();
  if (!client) return <p className="text-sm text-muted">Client not found.</p>;

  const name = (client.business_name as string) || [client.first_name, client.last_name].filter(Boolean).join(" ") || (client.email as string) || "Client";

  const { data: appts } = await supabase
    .from("appointments")
    .select("id, title, starts_at, status")
    .eq("client_id", params.id)
    .order("starts_at", { ascending: false, nullsFirst: false });
  const { data: reqs } = await supabase
    .from("requests")
    .select("id, category_key, status, created_at")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false });
  const { data: pays } = await supabase
    .from("payments")
    .select("id, type, amount, status, method, created_at")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false });

  const appointments = appts ?? [];
  const requests = reqs ?? [];
  const payments = pays ?? [];

  const due = payments.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const paid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const noShows = appointments.filter((a) => a.status === "no_show").length;

  // Services provided = distinct service they've actually requested (minus "Other").
  const providedKeys = new Set(
    requests.map((r) => r.category_key as string).filter((k) => k && k !== "other"),
  );
  const provided = SERVICES.filter((s) => s.key !== "other" && providedKeys.has(s.key));
  const couldOffer = SERVICES.filter((s) => s.key !== "other" && !providedKeys.has(s.key));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/staff/clients" className="text-sm text-brand-600">← All clients</Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink">{name}</h1>

      {/* Contact + summary */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <dl className="rounded-xl border border-line bg-white p-4 text-sm">
          {client.email && <div className="mb-2"><dt className="text-xs font-semibold uppercase text-muted">Email</dt><dd className="text-ink">{client.email as string}</dd></div>}
          {client.phone && <div className="mb-2"><dt className="text-xs font-semibold uppercase text-muted">Phone</dt><dd className="text-ink">{client.phone as string}</dd></div>}
          <div><dt className="text-xs font-semibold uppercase text-muted">Client since</dt><dd className="text-ink">{dateLabel(client.created_at as string)}</dd></div>
        </dl>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-line bg-white p-3 text-center">
            <div className={`font-display text-lg font-bold ${due > 0 ? "text-amber-700" : "text-ink"}`}>{formatMoney(due)}</div>
            <div className="text-xs text-muted">Due</div>
          </div>
          <div className="rounded-xl border border-line bg-white p-3 text-center">
            <div className="font-display text-lg font-bold text-ink">{formatMoney(paid)}</div>
            <div className="text-xs text-muted">Paid</div>
          </div>
          <div className="rounded-xl border border-line bg-white p-3 text-center">
            <div className={`font-display text-lg font-bold ${noShows > 0 ? "text-red-700" : "text-ink"}`}>{noShows}</div>
            <div className="text-xs text-muted">No-shows</div>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Services provided</p>
          {provided.length === 0 ? (
            <p className="mt-2 text-sm text-muted">None yet.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {provided.map((s) => (
                <span key={s.key} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-600">{s.label}</span>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm font-semibold text-ink">Services you could offer</p>
          {couldOffer.length === 0 ? (
            <p className="mt-2 text-sm text-muted">They&apos;ve used everything on the menu.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {couldOffer.map((s) => (
                <span key={s.key} className="rounded-full border border-line-strong px-2.5 py-1 text-xs font-semibold text-muted">{s.label}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Appointments */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink">Appointments ({appointments.length})</h2>
        <div className="mt-2 space-y-1.5">
          {appointments.length === 0 ? (
            <p className="rounded-lg border border-line bg-white px-3 py-4 text-center text-sm text-muted">No appointments.</p>
          ) : appointments.map((a) => (
            <Link key={a.id as string} href={`/dashboard/staff/appointments/${a.id}`}
              className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2.5 text-sm transition hover:border-line-strong">
              <span>
                <span className="font-medium text-ink">{(a.title as string) || "Appointment"}</span>
                <span className="block text-xs text-muted">{whenLabel(a.starts_at as string | null)}</span>
              </span>
              <span className="text-xs font-semibold text-muted">{APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus] ?? (a.status as string)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Payments */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink">Payments ({payments.length})</h2>
        <div className="mt-2 space-y-1.5">
          {payments.length === 0 ? (
            <p className="rounded-lg border border-line bg-white px-3 py-4 text-center text-sm text-muted">No fees or payments.</p>
          ) : payments.map((p) => (
            <div key={p.id as string} className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
              <span>
                <span className="font-medium text-ink">{PAYMENT_TYPE_LABEL[p.type as string] ?? (p.type as string)} · {formatMoney(p.amount as number)}</span>
                <span className="block text-xs text-muted">{dateLabel(p.created_at as string)}</span>
              </span>
              <span className={`text-xs font-semibold ${
                p.status === "paid" ? "text-green-700" : p.status === "pending" ? "text-amber-700" : "text-muted"
              }`}>
                {p.status === "paid"
                  ? `Paid${p.method ? ` · ${PAYMENT_METHOD_LABEL[p.method as string] ?? p.method}` : ""}`
                  : p.status === "void" ? "Waived" : "Due"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Requests */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-ink">Requests ({requests.length})</h2>
        <div className="mt-2 space-y-1.5">
          {requests.length === 0 ? (
            <p className="rounded-lg border border-line bg-white px-3 py-4 text-center text-sm text-muted">No requests.</p>
          ) : requests.map((r) => (
            <Link key={r.id as string} href={`/dashboard/staff/requests/${r.id}`}
              className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2.5 text-sm transition hover:border-line-strong">
              <span>
                <span className="font-medium text-ink">{serviceLabel(r.category_key as string)}</span>
                <span className="block text-xs text-muted">{dateLabel(r.created_at as string)}</span>
              </span>
              <span className="text-xs font-semibold text-muted">{r.status as string}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
