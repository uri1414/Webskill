// Client home — a visual, progress-driven overview. Active requests show an
// amber progress bar while the team reviews them; confirmed upcoming ones turn
// green and pop open with the appointment's time, what's owed, and the
// what-to-bring checklist. Everything done/closed drops into a collapsible,
// clearable "Past requests" section so the home stays clean. RLS scopes every
// query to this client.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { formatMoney } from "@/lib/payments";
import { prepFor } from "@/lib/prep";
import { PrepChecklist } from "@/components/PrepChecklist";
import { RequestHistory, type HistoryItem } from "@/components/RequestHistory";

const UPCOMING_APPT = ["requested", "scheduled", "confirmed", "checked_in"];

function whenLabel(iso: string | null): string {
  if (!iso) return "Time to be confirmed";
  return new Date(iso).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function dateShort(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Amber stage (still being reviewed) → progress-bar card. Anything else is
// handled separately (upcoming green card, or history).
function amberStage(status: string): { label: string; pct: number; index: number } | null {
  if (status === "new" || status === "routed") return { label: "Received", pct: 34, index: 0 };
  if (status === "in_progress" || status === "waiting_on_client") return { label: "In review", pct: 67, index: 1 };
  return null;
}
const STEPS = ["Received", "In review", "Confirmed"];

export default async function ClientHome() {
  const ctx = await requireContext();
  const supabase = createClient();

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", ctx.userId).single();
  const firstName = ((profile?.full_name as string) || (profile?.email as string) || "there").split(" ")[0];

  const { data: reqs } = await supabase
    .from("requests").select("id, subject, category_key, status, created_at").order("created_at", { ascending: false });
  const requests = reqs ?? [];
  const reqIds = requests.map((r) => r.id as string);

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

  const now = Date.now();
  type Active = { id: string; subject: string; label: string; pct: number; index: number };
  type Upcoming = { id: string; subject: string; apptId: string | null; startsAt: string | null; due: number; paid: number; categoryKey: string };
  const active: Active[] = [];
  const upcoming: Upcoming[] = [];
  const history: HistoryItem[] = [];

  for (const r of requests) {
    const id = r.id as string;
    const subject = (r.subject as string) || "Appointment request";
    const status = r.status as string;
    const amber = amberStage(status);

    if (amber) {
      active.push({ id, subject, ...amber });
      continue;
    }
    if (status === "resolved") {
      const apptId = apptByReq.get(id) ?? null;
      const appt = apptId ? apptById.get(apptId) : null;
      const past = appt?.starts_at ? new Date(appt.starts_at).getTime() < now : false;
      const isUpcoming = appt ? UPCOMING_APPT.includes(appt.status) && !past : !past;
      if (isUpcoming) {
        const fee = apptId ? feeByAppt.get(apptId) : undefined;
        upcoming.push({ id, subject, apptId, startsAt: appt?.starts_at ?? null, due: fee?.due ?? 0, paid: fee?.paid ?? 0, categoryKey: (r.category_key as string) ?? "" });
      } else {
        const tone: HistoryItem["tone"] = appt?.status === "cancelled" || appt?.status === "no_show" ? "red" : "green";
        const label = appt?.status === "completed" ? "Completed" : appt?.status === "cancelled" ? "Cancelled" : appt?.status === "no_show" ? "Missed" : "Past";
        history.push({ id, subject, dateText: dateShort(appt?.starts_at ?? (r.created_at as string)), statusLabel: label, tone });
      }
      continue;
    }
    // closed / no_action / spam
    history.push({ id, subject, dateText: dateShort(r.created_at as string), statusLabel: "Closed", tone: "grey" });
  }

  const hasCards = upcoming.length + active.length > 0;

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
        {!hasCards ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-white px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">Nothing active right now</p>
            <p className="mt-1 text-sm text-muted">Request an appointment and track its progress here.</p>
            <Link href="/dashboard/client/requests/new" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600">Request an appointment</Link>
          </div>
        ) : (
          <>
            {/* Confirmed & upcoming — green cards that pop open the details */}
            {upcoming.map((u) => {
              const prep = prepFor(u.categoryKey);
              return (
                <div key={u.id} className="overflow-hidden rounded-xl border border-line bg-white">
                  <Link href={`/dashboard/client/requests/${u.id}`} className="block px-4 pt-4 transition hover:bg-surface-soft/40">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold text-ink">{u.subject}</p>
                      <span className="flex-none rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">Confirmed</span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-soft">
                      <div className="h-full w-full rounded-full bg-green-500 transition-all duration-500" />
                    </div>
                    <div className="mt-1.5 flex justify-between pb-4 text-[11px] font-semibold text-green-700">
                      {STEPS.map((s) => <span key={s}>{s}</span>)}
                    </div>
                  </Link>

                  <div className="border-t border-green-200 bg-green-50/60 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Expected time</p>
                        <p className="text-sm font-semibold text-ink">{whenLabel(u.startsAt)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Payment</p>
                        {u.due > 0 ? (
                          <p className="text-sm font-semibold text-amber-700">{formatMoney(u.due)} due</p>
                        ) : u.paid > 0 ? (
                          <p className="text-sm font-semibold text-green-700">Paid {formatMoney(u.paid)}</p>
                        ) : (
                          <p className="text-sm text-muted">To be confirmed</p>
                        )}
                      </div>
                      {u.startsAt && (
                        <a href={`/dashboard/appointments/${u.apptId}`} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                          <span aria-hidden>📅</span> Add to calendar
                        </a>
                      )}
                    </div>
                    {prep && (
                      <div className="mt-3 rounded-lg border border-green-200 bg-white p-3">
                        <PrepChecklist id={(u.apptId ?? u.id)} bring={prep.bring} avoid={prep.avoid} note={prep.note} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Being reviewed — amber progress cards */}
            {active.map((a) => (
              <Link key={a.id} href={`/dashboard/client/requests/${a.id}`} className="block rounded-xl border border-line bg-white px-4 py-4 transition hover:border-brand hover:shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold text-ink">{a.subject}</p>
                  <span className="flex-none rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{a.label}</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-soft">
                  <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${a.pct}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] font-semibold">
                  {STEPS.map((label, i) => (
                    <span key={label} className={i <= a.index ? "text-amber-700" : "text-muted"}>{label}</span>
                  ))}
                </div>
              </Link>
            ))}
          </>
        )}
      </div>

      {/* Past / closed — tucked away, clearable */}
      <RequestHistory items={history} />

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
