import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { NotificationBell } from "@/components/NotificationBell";
import { PortalNav, PortalTitle, MobileNav, type NavItem } from "@/components/PortalNav";
import { type UINote } from "@/lib/notify-ui";

// Nav — our Rosa features, in the Baseline sidebar setup.
const STAFF_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard/staff" },
  { label: "Requests", href: "/dashboard/staff/requests" },
  { label: "Appointments", href: "/dashboard/staff/appointments" },
  { label: "Tasks", href: "/dashboard/staff/tasks" },
  { label: "Clients", href: "/dashboard/staff/clients" },
];
const STAFF_SOON = ["Online payments", "Messaging", "Reports"];
const CLIENT_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard/client" },
  { label: "My appointments", href: "/dashboard/client/appointments" },
  { label: "New request", href: "/dashboard/client/requests/new" },
];
const CLIENT_SOON = ["Pay online", "Messages", "Documents"];

function Logo({ sub, dark }: { sub: string; dark?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2 pb-4 pt-1">
      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-brand font-display text-base font-bold text-white shadow-brand">R</span>
      <span className={`font-display text-[16px] ${dark ? "text-white" : "text-ink"}`}>
        <span className="font-bold">Rosa &amp; Co.</span>{" "}
        <span className={`font-semibold ${dark ? "text-[#6B7385]" : "text-muted"}`}>{sub}</span>
      </span>
    </Link>
  );
}

function Shell({
  brandSub, nav, soon, name, initials, role, notifications, unread, dark = false, badge, helpHref,
  children,
}: {
  brandSub: string;
  nav: NavItem[];
  soon: string[];
  name: string;
  initials: string;
  role: string;
  notifications: UINote[];
  unread: number;
  dark?: boolean;
  badge?: string;
  helpHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-soft">
      {/* Sidebar */}
      <aside className={`hidden w-[236px] flex-none flex-col overflow-y-auto px-3.5 py-5 md:flex ${dark ? "border-r border-[#1F242E] bg-ink" : "border-r border-line bg-white"}`}>
        <div className="flex items-center justify-between">
          <Logo sub={brandSub} dark={dark} />
          {badge ? <span className="mr-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent-ink">{badge}</span> : null}
        </div>
        <PortalNav items={nav} dark={dark} />
        <div className={`mt-5 px-3 font-display text-[10.5px] font-semibold uppercase tracking-[0.13em] ${dark ? "text-[#6B7385]" : "text-muted"}`}>
          Coming soon
        </div>
        <div className="mt-1.5 flex flex-col gap-0.5">
          {soon.map((label) => (
            <div key={label} className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] ${dark ? "text-[#6B7385]" : "text-[#9AA1B2]"}`}>
              <span className={`h-2 w-2 flex-none rounded-[2px] ${dark ? "bg-[#2A2F3C]" : "bg-line-strong"}`} />
              <span className="flex-1">{label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${dark ? "bg-ink-800 text-[#6B7385]" : "border border-line bg-surface-soft text-muted"}`}>Soon</span>
            </div>
          ))}
        </div>
        {helpHref && (
          <div className={`mt-auto rounded-xl p-3.5 ${dark ? "border border-[#2A2F3C] bg-ink-800" : "border border-line bg-surface-cream"}`}>
            <div className={`mb-1 font-display text-[13.5px] font-semibold ${dark ? "text-white" : "text-ink"}`}>Need a hand?</div>
            <div className={`mb-2.5 text-[12.5px] leading-relaxed ${dark ? "text-[#9AA1B2]" : "text-muted"}`}>We reply within one business day.</div>
            <Link href={helpHref} className={`inline-block rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition hover:-translate-y-0.5 ${dark ? "bg-accent text-accent-ink" : "bg-ink text-white"}`}>
              Start a request
            </Link>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[62px] flex-none items-center gap-3.5 border-b border-line bg-white px-6">
          <div className="flex-1 font-display text-lg font-bold text-ink">
            <PortalTitle items={nav} fallback="Dashboard" />
          </div>
          <NotificationBell notifications={notifications} unread={unread} />
          <div className="flex items-center gap-2 rounded-full px-1.5 py-1">
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-600">{initials}</span>
            <span className="hidden text-[13.5px] font-semibold text-ink sm:inline">{name}</span>
            <span className="hidden text-xs capitalize text-muted lg:inline">· {role}</span>
            <form action="/auth/signout" method="post" className="ml-1">
              <button type="submit" className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-soft">Sign out</button>
            </form>
          </div>
        </header>
        <MobileNav items={nav} />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1120px] px-6 py-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const supabase = createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", ctx.userId).single();
  const name = profile?.full_name || profile?.email || "there";
  const initials = (profile?.full_name || profile?.email || "U")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join("");
  const isStaff = ctx.role === "staff" || ctx.role === "admin";

  // Notification center: the user's own recent notifications + unread count.
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

  // Staff = the internal side → Baseline's dark "admin" sidebar. Client = the
  // light "customer" sidebar with a help card.
  if (isStaff) {
    return (
      <Shell brandSub="Staff" badge="Internal" dark nav={STAFF_NAV} soon={STAFF_SOON}
        name={name} initials={initials} role={ctx.role} notifications={notifications} unread={unread ?? 0}>
        {children}
      </Shell>
    );
  }
  return (
    <Shell brandSub="Portal" nav={CLIENT_NAV} soon={CLIENT_SOON} helpHref="/dashboard/client/requests/new"
      name={name} initials={initials} role={ctx.role} notifications={notifications} unread={unread ?? 0}>
      {children}
    </Shell>
  );
}
