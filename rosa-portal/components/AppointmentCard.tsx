// A single appointment card. The progress bar tracks TIME — it fills as the
// appointment approaches (empty when it's far off, full when it's here) — and
// the card carries the countdown, the length of the visit, the fee, an
// add-to-calendar link, and the what-to-bring checklist. Shared by the client
// home and the appointments list. Server component (PrepChecklist is its own
// client island).
import Link from "next/link";
import { formatMoney } from "@/lib/payments";
import { PrepChecklist } from "@/components/PrepChecklist";

type Prep = { bring: string[]; avoid?: string[]; note?: string };
type Tone = "green" | "brand" | "grey";

const DAY = 86_400_000;
const WINDOW = 14 * DAY; // the bar starts filling ~2 weeks out

function timeInfo(startsAt: string | null): { pct: number; tone: Tone; countdown: string } {
  if (!startsAt) return { pct: 0, tone: "grey", countdown: "Time to be confirmed" };
  const diff = new Date(startsAt).getTime() - Date.now();
  if (diff <= 0) return { pct: 100, tone: "green", countdown: "Happening now" };
  let countdown: string;
  if (diff < 3_600_000) countdown = `In ${Math.max(1, Math.round(diff / 60_000))} min`;
  else if (diff < DAY) countdown = `In ${Math.round(diff / 3_600_000)} hr`;
  else countdown = `In ${Math.round(diff / DAY)} day${Math.round(diff / DAY) === 1 ? "" : "s"}`;
  const pct = Math.min(100, Math.max(4, (1 - diff / WINDOW) * 100));
  const tone: Tone = diff < 2 * DAY ? "green" : "brand"; // imminent → green
  return { pct, tone, countdown };
}

function durationLabel(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt || !endsAt) return null;
  const mins = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return [h ? `${h} hr` : null, m ? `${m} min` : null].filter(Boolean).join(" ");
}

function whenLabel(iso: string | null): string {
  if (!iso) return "Time to be confirmed";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const BAR: Record<Tone, string> = { green: "bg-green-500", brand: "bg-brand", grey: "bg-line-strong" };
const CHIP: Record<Tone, string> = { green: "bg-green-50 text-green-700", brand: "bg-brand-soft text-brand-600", grey: "bg-surface-soft text-muted" };

export function AppointmentCard({
  apptId, href, title, statusLabel, startsAt, endsAt, due, paid, prep,
}: {
  apptId: string;
  href: string;
  title: string;
  statusLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  due: number;
  paid: number;
  prep: Prep | null;
}) {
  const t = timeInfo(startsAt);
  const duration = durationLabel(startsAt, endsAt);
  const showCalendar = !!startsAt;

  return (
    <div className="lift overflow-hidden rounded-xl border border-line bg-white hover:border-brand hover:shadow-card">
      <Link href={href} className="block px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-semibold text-ink">{title}</p>
          <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP[t.tone]}`}>{statusLabel}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{t.countdown}</span>
          <span className="text-xs text-muted">{whenLabel(startsAt)}</span>
        </div>
        {/* Time bar — fills as the appointment approaches */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-soft">
          <div className={`h-full rounded-full transition-all duration-500 ${BAR[t.tone]}`} style={{ width: `${t.pct}%` }} />
        </div>
        <div className="h-4" />
      </Link>

      {/* Length + fee + calendar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-3 text-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Length</p>
          <p className="font-semibold text-ink">{duration ?? "—"}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Fee</p>
          {due > 0 ? (
            <p className="font-semibold text-amber-700">{formatMoney(due)} due</p>
          ) : paid > 0 ? (
            <p className="font-semibold text-green-700">Paid {formatMoney(paid)}</p>
          ) : (
            <p className="text-muted">To be confirmed</p>
          )}
        </div>
        {showCalendar && (
          <a href={`/dashboard/appointments/${apptId}`} className="ml-auto inline-flex items-center gap-1.5 font-semibold text-brand-600">
            <span aria-hidden>📅</span> Add to calendar
          </a>
        )}
      </div>

      {prep && (
        <div className="border-t border-line px-4 py-3">
          <PrepChecklist id={apptId} bring={prep.bring} avoid={prep.avoid} note={prep.note} />
        </div>
      )}
    </div>
  );
}
