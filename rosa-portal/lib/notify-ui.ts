// Presentation helpers for notifications — shared by the bell and the inbox.
// Pure data/functions (no server or client imports) so both a server component
// and a client component can use them.

export type UINote = {
  id: string;
  type: string;
  title: string;
  link: string | null;
  createdAt: string;
  read: boolean;
};

export type NoteMeta = { icon: string; tint: string };

// Type → icon + tint. Keeps the list scannable at a glance.
const META: Record<string, NoteMeta> = {
  request_created:       { icon: "📥", tint: "bg-blue-50 text-blue-700" },
  appointment_confirmed: { icon: "✅", tint: "bg-green-50 text-green-700" },
  appointment_created:   { icon: "✅", tint: "bg-green-50 text-green-700" },
  appointment_scheduled: { icon: "🗓️", tint: "bg-brand-soft text-brand-600" },
  appointment_cancelled: { icon: "🚫", tint: "bg-red-50 text-red-700" },
  payment_due:           { icon: "💳", tint: "bg-amber-50 text-amber-700" },
};

export function noteMeta(type: string): NoteMeta {
  return META[type] ?? { icon: "🔔", tint: "bg-surface-soft text-muted" };
}

// "just now" · "5m ago" · "3h ago" · "2d ago" · "Aug 6"
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
