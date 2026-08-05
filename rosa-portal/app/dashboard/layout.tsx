import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";

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

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="flex h-14 items-center gap-5 border-b border-line bg-white px-5">
        <Link href="/dashboard" className="font-display text-[15px] font-bold text-ink">
          Rosa &amp; Co. <span className="font-semibold text-muted">CPA</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {isStaff ? (
            <Link href="/dashboard/staff/requests" className="font-semibold text-brand">Requests</Link>
          ) : (
            <>
              <Link href="/dashboard/client" className="font-semibold text-brand">My requests</Link>
              <Link href="/dashboard/client/requests/new" className="font-semibold text-brand">New request</Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
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
