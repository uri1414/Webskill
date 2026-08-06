// Skeleton loading placeholders. `Skeleton` is one shimmering block; the rest
// compose them into content-shaped stand-ins used by route loading.tsx files.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-md ${className}`} />;
}

// A card stand-in that mirrors the appointment / request cards (title row,
// progress bar, a couple of detail chips).
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-2 w-full rounded-full" />
      <div className="mt-3 flex gap-4">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

// A compact one-line row stand-in (list pages).
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-line bg-white px-3.5 py-3">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="mt-1.5 h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

// A whole page stand-in: heading + a stack of card or row skeletons.
export function SkeletonPage({ variant = "card", count = 4 }: { variant?: "card" | "row"; count?: number }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: count }, (_, i) =>
          variant === "row" ? <SkeletonRow key={i} /> : <SkeletonCard key={i} />,
        )}
      </div>
    </div>
  );
}
