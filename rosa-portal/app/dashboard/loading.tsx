// Default loading state for dashboard navigations. The layout (sidebar +
// header) stays mounted; only this content area suspends, so a click shows a
// content-shaped skeleton immediately while the next page renders.
import { SkeletonPage } from "@/components/Skeleton";

export default function DashboardLoading() {
  return <SkeletonPage variant="card" count={4} />;
}
