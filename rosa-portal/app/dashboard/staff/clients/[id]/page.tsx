// Staff Client profile — the whole relationship in one place. A two-column
// layout: the left column is the HISTORY (services summary, appointments,
// payments, requests); the right rail is WHO THEY ARE + MANAGE THEM (portal
// access, contact, money, add-a-business, edit details) so actions are always
// reachable without scrolling past the history. Read-only history; an edit
// card manages type, details, and the business↔owner link.
import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/authz";
import { SERVICES, serviceLabel } from "@/lib/services";
import { formatMoney, PAYMENT_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/payments";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/lib/appointments";
import { updateClientAction, addBusinessAction } from "../actions";

type ClientLite = { id: string; first_name?: string | null; last_name?: string | null; business_name: string | null; email?: string | null };
function displayName(c: ClientLite): string {
  return c.business_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Client";
}
function whenLabel(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "No time set";
}
function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none transition focus:border-brand";
const histRow = "lift flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2.5 text-sm hover:border-brand hover:shadow-card";

export default async function ClientProfile({ params }: { params: { id: string } }) {
  await requireCapability("clients.read");
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, business_name, email, phone, status, created_at, client_type, owner_client_id, profile_id")
    .eq("id", params.id)
    .single();
  if (!client) return <p className="text-sm text-muted">Client not found.</p>;

  const isBusiness = (client.client_type as string) === "business";
  const name = displayName(client as ClientLite);
  const hasAccess = !!client.profile_id;
  const email = client.email as string | null;
  const h = headers();
  const signupUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}/signup`;

  // Linked records: a business shows its owner; an individual shows its businesses.
  const { data: owner } = client.owner_client_id
    ? await supabase.from("clients").select("id, first_name, last_name, business_name, email").eq("id", client.owner_client_id as string).maybeSingle()
    : { data: null };
  const { data: businesses } = await supabase
    .from("clients")
    .select("id, business_name")
    .eq("owner_client_id", params.id)
    .order("created_at", { ascending: false });
  // Individuals available as an owner for this business.
  const { data: individuals } = await supabase
    .from("clients")
    .select("id, first_name, last_name, business_name, email")
    .eq("client_type", "individual")
    .neq("id", params.id)
    .order("created_at", { ascending: false });

  const { data: appts } = await supabase
    .from("appointments").select("id, title, starts_at, status").eq("client_id", params.id)
    .order("starts_at", { ascending: false, nullsFirst: false });
  const { data: reqs } = await supabase
    .from("requests").select("id, category_key, status, created_at").eq("client_id", params.id)
    .order("created_at", { ascending: false });
  const { data: pays } = await supabase
    .from("payments").select("id, type, amount, status, method, created_at").eq("client_id", params.id)
    .order("created_at", { ascending: false });

  const appointments = appts ?? [];
  const requests = reqs ?? [];
  const payments = pays ?? [];
  const ownedBusinesses = businesses ?? [];

  const due = payments.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const paid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const noShows = appointments.filter((a) => a.status === "no_show").length;

  const providedKeys = new Set(requests.map((r) => r.category_key as string).filter((k) => k && k !== "other"));
  const provided = SERVICES.filter((s) => s.key !== "other" && providedKeys.has(s.key));
  const couldOffer = SERVICES.filter((s) => s.key !== "other" && !providedKeys.has(s.key));

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/staff/clients" className="text-sm text-brand-600">← All clients</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">{name}</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isBusiness ? "bg-brand-soft text-brand-600" : "bg-surface-soft text-muted"}`}>
          {isBusiness ? "Business" : "Individual"}
        </span>
        <Link href={`/dashboard/staff/appointments/new?client=${params.id}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-brand transition hover:bg-brand-600">
          <span aria-hidden className="text-sm leading-none">+</span> New appointment
        </Link>
      </div>

      {/* Linked owner / businesses */}
      {isBusiness && owner && (
        <p className="mt-1 text-sm text-muted">
          Owner: <Link href={`/dashboard/staff/clients/${owner.id}`} className="font-semibold text-brand-600">{displayName(owner as ClientLite)}</Link>
        </p>
      )}
      {!isBusiness && ownedBusinesses.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          Businesses:{" "}
          {ownedBusinesses.map((b, i) => (
            <span key={b.id as string}>
              {i > 0 && ", "}
              <Link href={`/dashboard/staff/clients/${b.id}`} className="font-semibold text-brand-600">{(b.business_name as string) || "Business"}</Link>
            </span>
          ))}
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Main column: the relationship history ───────────────── */}
        <div className="min-w-0 space-y-6">
          {/* Services */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-sm font-semibold text-ink">Services provided</p>
              {provided.length === 0 ? <p className="mt-2 text-sm text-muted">None yet.</p> : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {provided.map((s) => <span key={s.key} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-600">{s.label}</span>)}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="text-sm font-semibold text-ink">Services you could offer</p>
              {couldOffer.length === 0 ? <p className="mt-2 text-sm text-muted">They&apos;ve used everything on the menu.</p> : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {couldOffer.map((s) => <span key={s.key} className="rounded-full border border-line-strong px-2.5 py-1 text-xs font-semibold text-muted">{s.label}</span>)}
                </div>
              )}
            </div>
          </div>

          {/* Appointments */}
          <section>
            <h2 className="text-sm font-semibold text-ink">Appointments ({appointments.length})</h2>
            <div className="mt-2 space-y-1.5">
              {appointments.length === 0 ? (
                <p className="rounded-lg border border-line bg-white px-3 py-4 text-center text-sm text-muted">No appointments.</p>
              ) : appointments.map((a) => (
                <Link key={a.id as string} href={`/dashboard/staff/appointments/${a.id}`} className={histRow}>
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
          <section>
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
                  <span className={`text-xs font-semibold ${p.status === "paid" ? "text-green-700" : p.status === "pending" ? "text-amber-700" : "text-muted"}`}>
                    {p.status === "paid" ? `Paid${p.method ? ` · ${PAYMENT_METHOD_LABEL[p.method as string] ?? p.method}` : ""}` : p.status === "void" ? "Waived" : "Due"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Requests */}
          <section>
            <h2 className="text-sm font-semibold text-ink">Requests ({requests.length})</h2>
            <div className="mt-2 space-y-1.5">
              {requests.length === 0 ? (
                <p className="rounded-lg border border-line bg-white px-3 py-4 text-center text-sm text-muted">No requests.</p>
              ) : requests.map((r) => (
                <Link key={r.id as string} href={`/dashboard/staff/requests/${r.id}`} className={histRow}>
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

        {/* ── Right rail: who they are + manage them ────────────── */}
        <aside className="space-y-4">
          {/* Money at a glance */}
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

          {/* Portal access (individuals only) */}
          {!isBusiness && (
            <div className="rounded-xl border border-line bg-white p-4 text-sm">
              {hasAccess ? (
                <p className="font-semibold text-green-700">✓ Has portal access</p>
              ) : email ? (
                <>
                  <p className="font-semibold text-ink">Not on the portal yet</p>
                  <p className="mt-1 text-muted">
                    Invite them: have them sign up at <span className="break-all font-semibold text-ink">{signupUrl}</span> using <span className="font-semibold text-ink">{email}</span>. Their account links to this profile automatically.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-ink">Not on the portal yet</p>
                  <p className="mt-1 text-muted">Add an email under <span className="font-semibold">Edit client details</span>, then invite them to sign up with it.</p>
                </>
              )}
            </div>
          )}

          {/* Contact */}
          <dl className="rounded-xl border border-line bg-white p-4 text-sm">
            {client.email && <div className="mb-2"><dt className="text-xs font-semibold uppercase text-muted">Email</dt><dd className="break-all text-ink">{client.email as string}</dd></div>}
            {client.phone && <div className="mb-2"><dt className="text-xs font-semibold uppercase text-muted">Phone</dt><dd className="text-ink">{client.phone as string}</dd></div>}
            <div><dt className="text-xs font-semibold uppercase text-muted">Client since</dt><dd className="text-ink">{dateLabel(client.created_at as string)}</dd></div>
          </dl>

          {/* Add a business (individuals only) */}
          {!isBusiness && (
            <form action={addBusinessAction} className="rounded-xl border border-line bg-white p-4">
              <p className="text-sm font-semibold text-ink">Add a business for this client</p>
              <p className="mt-0.5 text-xs text-muted">Creates a linked business profile owned by {name}.</p>
              <input type="hidden" name="ownerClientId" value={params.id} />
              <input name="business_name" required placeholder="Business name" className={field} />
              <input name="email" placeholder="Business email (optional)" className={field} />
              <input name="phone" placeholder="Phone (optional)" className={field} />
              <button type="submit" className="mt-3 w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">
                Add business
              </button>
            </form>
          )}

          {/* Edit client details */}
          <details className="rounded-xl border border-line bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Edit client details</summary>
            <form action={updateClientAction} className="mt-3 space-y-2">
              <input type="hidden" name="clientId" value={params.id} />
              <div>
                <label className="block text-xs font-semibold text-muted">Type</label>
                <select name="client_type" defaultValue={isBusiness ? "business" : "individual"} className={field}>
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div><label className="block text-xs font-semibold text-muted">First name</label><input name="first_name" defaultValue={(client.first_name as string) ?? ""} className={field} /></div>
              <div><label className="block text-xs font-semibold text-muted">Last name</label><input name="last_name" defaultValue={(client.last_name as string) ?? ""} className={field} /></div>
              <div><label className="block text-xs font-semibold text-muted">Business name</label><input name="business_name" defaultValue={(client.business_name as string) ?? ""} className={field} /></div>
              <div><label className="block text-xs font-semibold text-muted">Email</label><input name="email" defaultValue={(client.email as string) ?? ""} className={field} /></div>
              <div><label className="block text-xs font-semibold text-muted">Phone</label><input name="phone" defaultValue={(client.phone as string) ?? ""} className={field} /></div>
              <div>
                <label className="block text-xs font-semibold text-muted">Owner <span className="font-normal">(businesses only — link to the owner&apos;s personal profile)</span></label>
                <select name="owner_client_id" defaultValue={(client.owner_client_id as string) ?? ""} className={field}>
                  <option value="">— none —</option>
                  {(individuals ?? []).map((ind) => (
                    <option key={ind.id as string} value={ind.id as string}>{displayName(ind as ClientLite)}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
                Save details
              </button>
            </form>
          </details>
        </aside>
      </div>
    </div>
  );
}
