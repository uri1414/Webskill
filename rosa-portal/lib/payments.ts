// ============================================================================
// payments.ts — payment/fee lifecycle (in-person / manual for v1).
//
// A payment is an OBLIGATION first (status 'pending' = owed) and a RECORD of
// pay second (status 'paid'). Staff create and settle them; a client can only
// read their own (RLS: payments_staff / payments_own_read). Online checkout
// (Stripe) will later flip status to 'paid' via webhook — same rows, no schema
// change. Sensitive detail stays out of notifications; the amount is the
// client's own fee, so it's fine to show.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { assertCan, type Context } from "@/lib/authz";

export type PaymentType =
  | "service_fee" | "deposit" | "cancellation_fee" | "no_show_fee"
  | "invoice" | "retainer" | "consult_fee";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "void";
export type PaymentMethod = "card" | "cash" | "check" | "ach" | "other";

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  service_fee: "Service fee",
  deposit: "Deposit",
  cancellation_fee: "Cancellation fee",
  no_show_fee: "No-show fee",
  invoice: "Invoice",
  retainer: "Retainer",
  consult_fee: "Consultation fee",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  card: "Card", cash: "Cash", check: "Check", ach: "Bank transfer", other: "Other",
};

// numeric(10,2) can arrive as a string from PostgREST — coerce before formatting.
export function formatMoney(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Record a fee/obligation on an appointment (or standalone). Notifies the client
// that a balance is due.
export async function createPayment(
  ctx: Context,
  input: {
    clientId: string;
    appointmentId?: string;
    type: PaymentType;
    amount: number;
    memo?: string;
  },
): Promise<Result<{ id: string }>> {
  assertCan(ctx, "payments.write");
  if (!(input.amount > 0)) return { ok: false, error: "amount must be greater than zero" };
  const supabase = createClient();

  const { data, error } = await supabase
    .from("payments")
    .insert({
      org_id: ctx.orgId,
      client_id: input.clientId,
      appointment_id: input.appointmentId ?? null,
      type: input.type,
      amount: input.amount,
      memo: input.memo ?? null,
      status: "pending",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  const { data: client } = await supabase
    .from("clients").select("profile_id").eq("id", input.clientId).single();
  if (client?.profile_id) {
    await notify({
      orgId: ctx.orgId,
      recipientId: client.profile_id as string,
      type: "payment_due",
      title: `Payment due: ${formatMoney(input.amount)}`,
      link: "/dashboard/client/appointments",
      entityType: "payment",
      entityId: data.id as string,
    });
  }

  return { ok: true, data: { id: data.id as string } };
}

// Settle a fee — records HOW it was paid and when. (In person for v1.)
export async function markPaymentPaid(
  ctx: Context,
  paymentId: string,
  method: PaymentMethod,
): Promise<Result<Record<string, never>>> {
  assertCan(ctx, "payments.write");
  const supabase = createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: "paid", method, paid_at: new Date().toISOString() })
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: {} };
}

// Waive a fee (e.g. forgive a late-cancel charge) — marks it void, not deleted,
// so the history is preserved.
export async function waivePayment(
  ctx: Context,
  paymentId: string,
): Promise<Result<Record<string, never>>> {
  assertCan(ctx, "payments.write");
  const supabase = createClient();
  const { error } = await supabase
    .from("payments")
    .update({ status: "void" })
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: {} };
}
