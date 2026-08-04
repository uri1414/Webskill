import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveContext } from "@/lib/authz";
import { PortalNav, PortalTitle, MobileNav, type NavItem } from "@/components/portalnav";

// ---- Customize per client: roles + each role's sidebar sections ------------
const CLIENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/client" },
  { label: "Appointments", href: "/dashboard/client/appointments" },
  { label: "Documents", href: "/dashboard/client/documents" },
  { label: "Billing", href: "/dashboard/client/billing" },
  { label: "Profile", href: "/dashboard/client/profile" },
];
const STAFF_NAV: NavItem[] = [
  { label: "Today", href: "/dashboard/staff" },
  { label: "Clients", href: "/dashboard/staff/clients" },
  { label: "Appointments", href: "/dashboard/staff/appointments" },
  { label: "Tasks", href: "/dashboard/staff/tasks" },
  { label: "Payments", href: "/dashboard/staff/payments" },
];

function Shell({ brandSub, nav, name, initials, dark = false, children }: {
  brandSub: string; nav: NavItem[]; name: string; initials: string; dark?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`hidden w-[236px] flex-none flex-col overflow-y-auto px-3.5 py-5 md:flex ${dark ? "border-r border-[#1F242E] bg-ink" : "border-r border-line bg-white"}`}>
        <span className={`px-2 pb-4 pt-1 font-display text-[17px] font-bold ${dark ? "text-white" : "text-ink"}`}>
          Acme <span className={`font-semibold ${dark ? "text-[#6B7385]" : "text-muted"}`}>{brandSub}</span>
        </span>
        <PortalNav items={nav} dark={dark} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[62px] flex-none items-center gap-3.5 border-b border-line bg-white px-6">
          <div className="flex-1 font-display text-lg font-bold text-ink"><PortalTitle items={nav} fallback="Dashboard" /></div>
          <div className="flex items-center gap-2">
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand-600">{initials}</span>
            <span className="hidden text-[13.5px] font-semibold text-ink sm:inline">{name}</span>
            <form action="/auth/signout" method="post" className="ml-1">
              <button type="submit" className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-soft">Sign out</button>
            </form>
          </div>
        </header>
        <MobileNav items={nav} />
        <div className="flex-1 overflow-y-auto"><div className="mx-auto max-w-[1120px] px-6 py-8">{children}</div></div>
      </div>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Role + active org come from MEMBERSHIPS (identity vs. membership), resolved
  // through the single-source authz layer — never from a profiles.role column.
  const ctx = await resolveContext();
  if (!ctx || ctx.memberships.length === 0) redirect("/login"); // signed in but not a member of any org
  const role = ctx.role;

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
  const name = profile?.full_name || profile?.email || "there";
  const initials = (profile?.full_name || profile?.email || "U").split(/[\s@]+/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join("");

  if (role === "staff" || role === "admin")
    return <Shell dark brandSub="Staff" nav={STAFF_NAV} name={name} initials={initials}>{children}</Shell>;
  return <Shell brandSub="Portal" nav={CLIENT_NAV} name={name} initials={initials}>{children}</Shell>;
}
