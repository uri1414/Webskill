// app/dashboard/staff/layout.tsx — PROTECTED staff subtree.
//
// Per-route guard (#16): this layout wraps every /dashboard/staff/* page. It
// resolves context and requires a staff-only capability; a client who guesses a
// staff URL is bounced to /dashboard before any staff page renders. RLS is the
// backstop — this is the app-layer gate that keeps the wrong role from ever
// loading the wrong subtree. See references/foundation.md, pillar 3.
import { requireCapability } from "@/lib/authz";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  // `clients.read` is in the staff/admin matrix but NOT the client one, so this
  // single check gates the whole staff area. Signed-out / non-member users are
  // sent to /login by requireContext inside; a client is sent to /dashboard.
  await requireCapability("clients.read");
  return <>{children}</>;
}
