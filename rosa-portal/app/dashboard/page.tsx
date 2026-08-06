import { redirect } from "next/navigation";
import { resolveContext } from "@/lib/authz";

// Role router: everyone lands on /dashboard, then goes to their surface —
// resolved from MEMBERSHIPS (the foundation model), not a profiles.role column.
export default async function DashboardIndex() {
  const ctx = await resolveContext();
  if (!ctx || ctx.memberships.length === 0) redirect("/login");
  if (ctx.role === "staff" || ctx.role === "admin") redirect("/dashboard/staff");
  redirect("/dashboard/client");
}
