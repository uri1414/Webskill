// Client home — a visual, progress-driven overview. Each request shows where it
// is: an amber bar while the team reviews it, turning green once it's confirmed.
// A confirmed card "pops" open with the appointment's time, what's owed, and the
// what-to-bring checklist. Read-only; RLS scopes every query to this client.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { formatMoney } from "@/lib/payments";
import { prepFor } from "@/lib/prep";
import { PrepChecklist } from "@/components/PrepChecklist";

// Where a request is in its journey, from its status. "resolved" = converted to
// a confirmed appointment.
type Tone = "amber" | "green" | "grey";
function stageOf(status: string): { label: string; note: string; tone: Tone; pct: number; index: number; closed: boolean } {
  switch (status) {
    case "new":
    case "routed":
      return { label: "Received", note: "We've got your request.", tone: "amber", pct: 34, index: 0, closed: false };
    case "in_progress":
    case "waiting_on_client":
      return { label: "In review", note: "Our team is looking at it.", tone: "amber", pct: 67, index: 1, closed: false };
    case "resolved":
      return { label: "Confirmed", note: "Your appointment is set.", tone: "green", pct: 100, index: 2, closed: false };
    default:
      return { label: "Closed", note: "This request is closed.", tone: "grey", pct: 100, index: 2, closed: true };
  }
}
const BAR: Record<Tone, string> = { amber: "bg-amber-400", green: "bg-green-500", grey: "bg-line-strong" };
const CHIP: Record<Tone, string> = { amber: "bg-amber-50 text-amber-700", green: "bg-green-50 text-green-700", grey: "bg-surface-soft text-muted" };
const STEPS = ["Received", "In review", "Confirmed"];

function whenLabel(iso: string | null): string {
  if (!iso) return "Time to be confirmed";
  return new Date(iso).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function ClientHome() {
  const ctx = await requireContext();
  const supabase = createClient();

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", ctx.userId).single();
  const firstName = ((profile?.full_name as string) || (profile?.email as string) || "there").split(" ")[0];

  const { data: reqs } = await supabase
    .from("requests").select("id, subject, category_key, status, created_at").order("created_at", { ascending: false });
  const requests = reqs ?? [];
  const reqIds = requests.map((r) => r.id as string);

  // Link each confirmed request to its appointment (RLS: own requests only).
  const { data: rels } = reqIds.length
    ? await supabase.from("request_relations").select("request_id, entity_id").eq("entity_type", "appointment").in("request_id", reqIds)
    : { data: [] };
  const apptByReq = new Map<string, string>();
  for (const r of rels ?? []) apptByReq.set(r.request_id as string, r.entity_id as string);

  const { data: appts } = await supabase.from("appointments").select("id, starts_at, service_key, status");
  const apptById = new Map<string, { starts_at: string | null; service_key: string | null; status: string }>();
  for (const a of appts ?? []) apptById.set(a.id as string, { starts_at: a.starts_at as string | null, service_key: a.service_key as string | null, status: a.status as string });

  const { data: pays } = await supabase.from("payments").select("appointment_id, amount, status");
  const feeByAppt = new Map<string, { due: number; paid: number }>();
  for (const p of pays ?? []) {
    const k = p.appointment_id as string;
    if (!k) continue;
    const cur = feeByAppt.get(k) ?? { due: 0, paid: 0 };
    const amt = Number(p.amount ?? 0);
    if (p.status === "pending") cur.due += amt;
    else if (p.status === "paid") cur.paid += amt;
    feeByAppt.set(k, cur);
  }
  const totalDue = [...feeByAppt.values()].reduce((s, f) => s + f.due, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-ink">Hi {firstName}</h1>
      <p className="mt-1 text-sm text-muted">Here&apos;s where everything stands.</p>

      {/* Balance banner — impossible to miss */}
      {totalDue > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="font-semibold text-amber-800">Balance due: {formatMoney(totalDue)}</p>
            <p className="mt-0.5 text-sm text-amber-700">Please have payment ready for your appointment.</p>
          </div>
          <span aria-hidden className="hidden text-2xl sm:block">💳</span>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-ink">Your requests</h2>
        <Link href="/dashboard/client/requests/new" className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">
          + New request
        </Link>
      </div>

      <div className="mt-3 space-y-3">
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">No requests yet</p>
            <p className="mt-1 text-sm text-muted">Request an appointment and track it here.</p>
            <Link href="/dashboard/client/requests/new" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">Request an appointment</Link>
          </div>
        ) : (
          requests.map((r) => {
            const st = stageOf(r.status as string);
            const confirmed = st.tone === "green";
            const apptId = apptByReq.get(r.id as string);
            const appt = apptId ? apptById.get(apptId) : null;
            const fee = apptId ? feeByAppt.get(apptId) : null;
            const prep = prepFor(r.category_key as string);
            return (
              <div key={r.id as string} className="overflow-hidden rounded-xl border border-line bg-white">
                <Link href={`/dashboard/client/requests/${r.id}`} className="block px-4 pt-4 transition hover:bg-surface-soft/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-semibold text-ink">{(r.subject as string) || "Appointment request"}</p>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP[st.tone]}`}>{st.label}</span>
                  </div>

                  {/* Progress bar — amber while reviewing, green when confirmed */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-soft">
                    <div className={`h-full rounded-full transition-all duration-500 ${BAR[st.tone]}`} style={{ width: `${st.pct}%` }} />
                  </div>
                  {!st.closed ? (
                    <div className="mt-1.5 flex justify-between pb-4 text-[11px] font-semibold">
                      {STEPS.map((label, i) => (
                        <span key={label} className={i <= st.index ? (confirmed ? "text-green-700" : "text-amber-700") : "text-muted"}>{label}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 pb-4 text-xs text-muted">{st.note}</p>
                  )}
                </Link>

                {/* Confirmed → the details pop open: time, payment, what to bring */}
                {confirmed && (
                  <div className="border-t border-green-200 bg-green-50/60 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Expected time</p>
                        <p className="text-sm font-semibold text-ink">{whenLabel(appt?.starts_at ?? null)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Payment</p>
                        {fee && fee.due > 0 ? (
                          <p className="text-sm font-semibold text-amber-700">{formatMoney(fee.due)} due</p>
                        ) : fee && fee.paid > 0 ? (
                          <p className="text-sm font-semibold text-green-700">Paid {formatMoney(fee.paid)}</p>
                        ) : (
                          <p className="text-sm text-muted">To be confirmed</p>
                        )}
                      </div>
                      {appt?.starts_at && (
                        <a href={`/dashboard/appointments/${apptId}`} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                          <span aria-hidden>📅</span> Add to calendar
                        </a>
                      )}
                    </div>

                    {prep && (
                      <div className="mt-3 rounded-lg border border-green-200 bg-white p-3">
                        <PrepChecklist id={(apptId ?? r.id) as string} bring={prep.bring} avoid={prep.avoid} note={prep.note} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Start / add a business — always via an in-person consultation first. */}
      <div className="mt-8 rounded-xl border border-line bg-surface-soft p-5">
        <h2 className="font-display text-base font-bold text-ink">Have a business — or want to start one?</h2>
        <p className="mt-1 text-sm text-muted">
          Rosa helps you add an existing business or form a new one, starting with a quick in-person consultation.
        </p>
        <Link href="/dashboard/client/requests/new?service=business_consult"
          className="mt-3 inline-block rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">
          Book a business consultation
        </Link>
      </div>
    </div>
  );
}
