import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { NotificationBell } from "@/components/NotificationBell";
import { type UINote } from "@/lib/notify-ui";

// Minimal shell. Auth + membership are resolved here (redirects to /login when
// signed out or not a member); role-scoped subtrees add their own capability
// guards (staff/layout, client/layout).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", ctx.userId)
    .single();
  const name = profile?.full_name || profile?.email || "there";
  const isStaff = ctx.role === "staff" || ctx.role === "admin";

  // Notification center: the user's own recent notifications + accurate unread
  // count (RLS scopes both to recipient_id = the signed-in user).
  const { data: noteRows } = await supabase
    .from("notifications")
    .select("id, type, title, link, created_at, status")
    .eq("recipient_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(12);
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", ctx.userId)
    .neq("status", "read");
  const notifications: UINote[] = (noteRows ?? []).map((n) => ({
    id: n.id as string,
    type: (n.type as string) ?? "",
    title: n.title as string,
    link: (n.link as string | null) ?? null,
    createdAt: n.created_at as string,
    read: n.status === "read",
  }));

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="flex h-14 items-center gap-5 border-b border-line bg-white px-5">
        <Link href="/dashboard" className="font-display text-[15px] font-bold text-ink">
          Rosa &amp; Co. <span className="font-semibold text-muted">CPA</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {isStaff ? (
            <>
              <Link href="/dashboard/staff" className="font-semibold text-brand">Home</Link>
              <Link href="/dashboard/staff/requests" className="font-semibold text-brand">Requests</Link>
              <Link href="/dashboard/staff/appointments" className="font-semibold text-brand">Appointments</Link>
              <Link href="/dashboard/staff/tasks" className="font-semibold text-brand">Tasks</Link>
              <Link href="/dashboard/staff/clients" className="font-semibold text-brand">Clients</Link>
            </>
          ) : (
            <>
              <Link href="/dashboard/client" className="font-semibold text-brand">Home</Link>
              <Link href="/dashboard/client/appointments" className="font-semibold text-brand">My appointments</Link>
              <Link href="/dashboard/client/requests/new" className="font-semibold text-brand">New request</Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <NotificationBell notifications={notifications} unread={unread ?? 0} />
          <span className="hidden text-muted sm:inline">
            {name} · <span className="capitalize">{ctx.role}</span>
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-soft">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-[1000px] px-5 py-8">{children}</main>
    </div>
  );
}
