// app/dashboard/staff/appointments/actions.ts — staff appointment actions.
//
// Thin: each wraps an Appointment Engine function in guardedAction (resolves
// context + asserts appointments.write before running), then revalidates. No
// lifecycle logic here — it lives in lib/appointments.ts; RLS backstops.
"use server";

import { revalidatePath } from "next/cache";
import { guardedAction } from "@/lib/authz";
import {
  rescheduleAppointment,
  transitionAppointment,
  type AppointmentStatus,
} from "@/lib/appointments";
import {
  createPayment,
  markPaymentPaid,
  waivePayment,
  type PaymentType,
  type PaymentMethod,
} from "@/lib/payments";

export async function rescheduleAppointmentAction(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim() || undefined;
  if (!startsAt) return; // the form marks it required; nothing to do without a time

  const run = guardedAction(
    "appointments.write",
    (ctx, args: { id: string; startsAt: string; endsAt?: string }) =>
      rescheduleAppointment(ctx, args.id, args.startsAt, args.endsAt),
  );
  await run({ id: appointmentId, startsAt, endsAt });
  revalidatePath(`/dashboard/staff/appointments/${appointmentId}`);
  revalidatePath("/dashboard/staff/appointments");
}

export async function setAppointmentStatusAction(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const status = String(formData.get("status") ?? "") as AppointmentStatus;

  const run = guardedAction(
    "appointments.write",
    (ctx, args: { id: string; status: AppointmentStatus }) =>
      transitionAppointment(ctx, args.id, args.status),
  );
  await run({ id: appointmentId, status });
  revalidatePath(`/dashboard/staff/appointments/${appointmentId}`);
  revalidatePath("/dashboard/staff/appointments");
}

// ---- Payments -------------------------------------------------------------

export async function addAppointmentFeeAction(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const type = String(formData.get("type") ?? "service_fee") as PaymentType;
  const memo = String(formData.get("memo") ?? "").trim() || undefined;
  const amount = Number(String(formData.get("amount") ?? "").trim());
  if (!(amount > 0)) return; // nothing to charge

  const run = guardedAction(
    "payments.write",
    (ctx, args: { clientId: string; appointmentId: string; type: PaymentType; amount: number; memo?: string }) =>
      createPayment(ctx, {
        clientId: args.clientId,
        appointmentId: args.appointmentId,
        type: args.type,
        amount: args.amount,
        memo: args.memo,
      }),
  );
  await run({ clientId, appointmentId, type, amount, memo });
  revalidatePath(`/dashboard/staff/appointments/${appointmentId}`);
}

export async function markPaymentPaidAction(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  const method = String(formData.get("method") ?? "cash") as PaymentMethod;

  const run = guardedAction(
    "payments.write",
    (ctx, args: { paymentId: string; method: PaymentMethod }) =>
      markPaymentPaid(ctx, args.paymentId, args.method),
  );
  await run({ paymentId, method });
  revalidatePath(`/dashboard/staff/appointments/${appointmentId}`);
}

export async function waivePaymentAction(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");

  const run = guardedAction("payments.write", (ctx, id: string) => waivePayment(ctx, id));
  await run(paymentId);
  revalidatePath(`/dashboard/staff/appointments/${appointmentId}`);
}
