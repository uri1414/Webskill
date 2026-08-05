// ============================================================================
// ics.ts — build a standard iCalendar (.ics) event for an appointment.
//
// .ics is the universal calendar format: Apple Calendar, Google Calendar, and
// Outlook all import it, so a client or staff member can add an appointment to
// whatever calendar app they already use — no OAuth, no vendor API. Times are
// emitted as "floating" local time (no timezone suffix), which means the
// calendar shows exactly the wall-clock time entered in the portal, matching
// how times are displayed everywhere else in the app.
// ============================================================================

// Escape a text value per RFC 5545 (commas, semicolons, backslashes, newlines).
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const pad = (n: number) => String(n).padStart(2, "0");

// Floating local time from a stored timestamp — uses the UTC components so the
// value matches the wall-clock time entered on the form (the app's convention).
function floating(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
}

// A UTC stamp (for DTSTAMP, which must be absolute).
function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export interface IcsEvent {
  id: string;
  title: string;
  description?: string;
  startsAt: string;   // ISO timestamp (required — no calendar event without a time)
  endsAt?: string;    // ISO timestamp; defaults to +1 hour
  cancelled?: boolean;
}

// Build the full VCALENDAR document. Default duration is one hour when no end
// time is set. A cancelled appointment is emitted with STATUS:CANCELLED so an
// already-imported event updates cleanly (same UID).
export function buildIcs(ev: IcsEvent): string {
  const start = floating(ev.startsAt);
  const endIso = ev.endsAt ?? new Date(new Date(ev.startsAt).getTime() + 60 * 60 * 1000).toISOString();
  const end = floating(endIso);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rosa & Co. CPA//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:appointment-${ev.id}@rosa-portal`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(ev.title)}`,
    ...(ev.description ? [`DESCRIPTION:${esc(ev.description)}`] : []),
    `STATUS:${ev.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // RFC 5545 wants CRLF line endings.
  return lines.join("\r\n");
}
