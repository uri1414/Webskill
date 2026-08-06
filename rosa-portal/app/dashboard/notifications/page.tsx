// Full notification inbox — the complete history for the signed-in user (client
// or staff), newest first. RLS scopes to their own. Uses the shared
// NotificationList for per-item read + navigate; "Mark all read" clears them.
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { NotificationList } from "@/components/NotificationList";
import { markAllNotificationsRead } from "./actions";
import { type UINote } from "@/lib/notify-ui";

export default async function NotificationsPage() {
  const ctx = await requireContext();
  const supabase = createClient();

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, link, created_at, status")
    .eq("recipient_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const notes: UINote[] = (data ?? []).map((n) => ({
    id: n.id as string,
    type: (n.type as string) ?? "",
    title: n.title as string,
    link: (n.link as string | null) ?? null,
    createdAt: n.created_at as string,
    read: n.status === "read",
  }));
  const unread = notes.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-xl font-bold text-ink">Notifications</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="text-sm font-semibold text-brand-600 hover:underline">Mark all read</button>
          </form>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
        <NotificationList notes={notes} />
      </div>
    </div>
  );
}
