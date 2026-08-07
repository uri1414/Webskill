// pricing.ts — the client-facing service menu with MOCKUP prices. These are
// placeholder estimates until Rosa confirms her real fees; the UI always frames
// them as "estimates, confirmed before work begins." Keyed by the same service
// keys used everywhere else (lib/services.ts).

export type ServicePricing = {
  emoji: string;
  blurb: string;
  price: string;       // headline price (mock)
  priceNote?: string;  // e.g. "per return", "in person"
  duration: string;    // typical length
};

// Ordered as it should appear on the Services page. "other" is intentionally
// omitted — it's the catch-all on the request form, not a listed offering.
export const SERVICE_ORDER = [
  "tax_prep",
  "tax_question",
  "business_tax",
  "bookkeeping",
  "business_consult",
  "doc_dropoff",
  "followup",
] as const;

export const PRICING: Record<string, ServicePricing> = {
  tax_prep: {
    emoji: "🧾",
    blurb: "Individual & joint returns prepared, reviewed, and filed — with every credit and deduction you qualify for.",
    price: "From $150",
    priceNote: "per return",
    duration: "About 1 hr",
  },
  tax_question: {
    emoji: "💬",
    blurb: "A focused sit-down to answer a specific tax question or walk through an IRS/state notice.",
    price: "$50",
    duration: "30 min",
  },
  business_tax: {
    emoji: "🏢",
    blurb: "Business returns, quarterly filings, payroll questions, and year-round tax planning for your company.",
    price: "From $300",
    duration: "1–2 hr",
  },
  bookkeeping: {
    emoji: "📚",
    blurb: "Clean up and maintain your books — statements, receipts, and reconciliations kept current.",
    price: "$75 / hr",
    duration: "About 1 hr",
  },
  business_consult: {
    emoji: "🚀",
    blurb: "Starting or restructuring a business? We'll walk through LLC vs S-corp, taxes, and setup.",
    price: "$100",
    priceNote: "in person",
    duration: "About 1 hr",
  },
  doc_dropoff: {
    emoji: "📥",
    blurb: "Drop off paperwork for us to review. No need to stay — we'll follow up once we've gone through it.",
    price: "Free",
    duration: "15 min",
  },
  followup: {
    emoji: "🔁",
    blurb: "A quick check-in on an existing appointment or an open item from your last visit.",
    price: "Free",
    duration: "30 min",
  },
};
