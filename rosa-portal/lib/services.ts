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

// Reverse lookup: label → key. Lets us recover a service for appointments
// created before service_key was captured (their title is the service label).
const LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
  SERVICES.map((s) => [s.label.toLowerCase(), s.key]),
);

export function serviceKeyFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  return LABEL_TO_KEY[title.trim().toLowerCase()] ?? null;
}

// The service key to use: the stored one, or — for older appointments that
// never captured it — inferred from the title.
export function resolveServiceKey(
  serviceKey: string | null | undefined,
  title: string | null | undefined,
): string | null {
  return (serviceKey && serviceKey.length > 0 ? serviceKey : null) ?? serviceKeyFromTitle(title);
}
