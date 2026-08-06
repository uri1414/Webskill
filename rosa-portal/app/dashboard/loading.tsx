// Instant loading state for dashboard navigations. The layout (header + nav)
// stays mounted; only this content area suspends, so a click feels immediate
// even while the server renders the next page.
export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
      <svg className="h-6 w-6 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
      </svg>
    </div>
  );
}
