// Client Services — the menu of what Rosa & Co. offers, as cards with mockup
// prices. Each card requests that service (pre-selects it on the request form).
// Prices are estimates; the real fee is confirmed before any work begins.
import Link from "next/link";
import { requireContext } from "@/lib/authz";
import { serviceLabel } from "@/lib/services";
import { PRICING, SERVICE_ORDER } from "@/lib/pricing";

export const metadata = { title: "Services" };

export default async function ServicesPage() {
  await requireContext();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-ink">Services</h1>
      <p className="mt-1 text-sm text-muted">What we can help you with. Pick one to request an appointment.</p>

      <div className="mt-4 rounded-xl border border-brand-soft bg-brand-soft/50 px-4 py-3 text-sm text-body">
        <span className="font-semibold text-ink">Prices are estimates.</span> We&apos;ll confirm your exact fee with you before any work begins.
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {SERVICE_ORDER.map((key) => {
          const p = PRICING[key];
          if (!p) return null;
          const free = p.price.toLowerCase() === "free";
          return (
            <div key={key} className="lift flex flex-col rounded-xl border border-line bg-white p-4 hover:border-brand hover:shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-soft text-xl">{p.emoji}</span>
                  <h2 className="font-display text-base font-bold text-ink">{serviceLabel(key)}</h2>
                </div>
                <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-bold ${free ? "bg-green-50 text-green-700" : "bg-brand text-white"}`}>
                  {p.price}
                </span>
              </div>

              <p className="mt-2.5 flex-1 text-sm text-muted">{p.blurb}</p>

              <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1">⏱️ {p.duration}</span>
                {p.priceNote && <span className="inline-flex items-center gap-1">· {p.priceNote}</span>}
              </div>

              <Link
                href={`/dashboard/client/requests/new?service=${key}`}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600"
              >
                Request this
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface-soft p-5 text-center">
        <p className="text-sm text-muted">Not sure which one you need?</p>
        <Link href="/dashboard/client/requests/new" className="mt-2 inline-block rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface-soft">
          Tell us what&apos;s going on
        </Link>
      </div>
    </div>
  );
}
