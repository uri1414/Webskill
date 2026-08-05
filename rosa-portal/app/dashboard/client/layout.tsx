// Client subtree. Needs only a signed-in member (not a staff capability).
// requireContext sends signed-out / non-member users to /login. Data stays
// org- and row-scoped by RLS.
import { requireContext } from "@/lib/authz";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await requireContext();
  return <>{children}</>;
}
