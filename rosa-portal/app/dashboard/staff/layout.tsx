// PROTECTED staff subtree. This layout wraps every /dashboard/staff/* page. It
// resolves context and requires a staff-only capability; a client who guesses a
// staff URL is bounced to /dashboard before any staff page renders. RLS is the
// backstop — this is the app-layer gate.
import { requireCapability } from "@/lib/authz";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("clients.read");
  return <>{children}</>;
}
