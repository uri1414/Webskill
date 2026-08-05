// ============================================================================
// prep.ts — "what to bring / what not to bring" per service. Shown to the client
// on their appointment so they arrive prepared. This is STARTER content keyed to
// each service; Rosa can refine the wording later (it's plain data — no schema).
// ============================================================================

export type Prep = {
  bring: string[];
  avoid?: string[];
  note?: string;
};

export const PREP: Record<string, Prep> = {
  tax_prep: {
    bring: [
      "Photo ID (and your spouse's, if filing jointly)",
      "Social Security cards for everyone on the return",
      "All W-2s and 1099s",
      "Last year's tax return",
      "Records for deductions (mortgage interest, property tax, charitable gifts, medical)",
      "Bank routing & account number for direct deposit",
    ],
    avoid: [
      "Original documents you need back the same day (bring copies)",
      "Unrelated paperwork — it slows things down",
    ],
  },
  tax_question: {
    bring: [
      "Any IRS or state letters/notices related to your question",
      "Last year's tax return, if it's relevant",
    ],
  },
  business_tax: {
    bring: [
      "Business profit & loss statement and balance sheet",
      "Last year's business tax return",
      "EIN / business registration",
      "Records of business income and expenses",
      "Payroll records, if you have employees",
    ],
    avoid: ["Personal (non-business) receipts unless we ask for them"],
  },
  bookkeeping: {
    bring: [
      "Bank and credit-card statements for the period",
      "Receipts and invoices",
      "Your current bookkeeping file or spreadsheet, if you have one",
    ],
  },
  doc_dropoff: {
    bring: [
      "The documents you're dropping off",
      "A short list of what's included, so nothing gets lost",
    ],
    note: "You don't need to stay — we'll follow up once we've reviewed everything.",
  },
  followup: {
    bring: [
      "Anything we asked for at your last appointment",
      "Your questions or notes since we last met",
    ],
  },
  business_consult: {
    bring: [
      "Photo ID",
      "If you already have a business: registration/EIN and recent financials",
      "If you're starting one: your idea and any research you've done",
      "Questions about structure (LLC, S-corp, sole proprietor) and taxes",
    ],
    note: "After this consultation, Rosa will set up your business profile in the portal.",
  },
  other: {
    bring: ["Anything relevant to what you described in your request"],
  },
};

export function prepFor(key: string | null | undefined): Prep | null {
  if (!key) return null;
  return PREP[key] ?? null;
}
