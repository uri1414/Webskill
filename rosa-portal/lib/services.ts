// The intake service catalog. Reuses the existing request-category mechanism:
// each service key IS a `request_categories.key` (seeded in 011). One source of
// truth for the form dropdown and the staff/client display labels.
export const SERVICES = [
  { key: "tax_prep", label: "Tax preparation" },
  { key: "tax_question", label: "Tax question" },
  { key: "business_tax", label: "Business tax help" },
  { key: "bookkeeping", label: "Bookkeeping" },
  { key: "doc_dropoff", label: "Document drop-off" },
  { key: "followup", label: "Existing appointment follow-up" },
  { key: "business_consult", label: "Business consultation" },
  { key: "other", label: "Other" },
] as const;

export const SERVICE_LABEL: Record<string, string> = Object.fromEntries(
  SERVICES.map((s) => [s.key, s.label]),
);

export function serviceLabel(key: string | null | undefined): string {
  if (!key) return "Appointment request";
  return SERVICE_LABEL[key] ?? key;
}
