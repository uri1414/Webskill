// app/dashboard/client/layout.tsx — client subtree.
//
// The client area needs no special capability beyond being a signed-in member,
// so it only requires context (not a staff capability). requireContext sends
// signed-out / non-member users to /login. A staff user visiting a client page
// is allowed — staff can read client-facing views — but their data is still
// org- and row-scoped by RLS. See references/foundation.md, pillar 3.
import { requireContext } from "@/lib/authz";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await requireContext();
  return <>{children}</>;
}
