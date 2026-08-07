// app/dashboard/staff/appointments/actions.ts — staff appointment actions.
//
// Thin: each wraps an Appointment Engine function in guardedAction (resolves
// context + asserts appointments.write before running), then revalidates. No
// lifecycle logic here — it lives in lib/appointments.ts; RLS backstops.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { guardedAction } from "@/lib/authz";
import {
  createAppointment,
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
import { SERVICE_LABEL } from "@/lib/services";
import { seedDefaultTasks } from "@/lib/tasks";

const NEW_APPT = "/dashboard/staff/appointments/new";

// Add minutes to a wall-clock "YYYY-MM-DDTHH:MM" value, staying in the same
// wall-clock convention starts_at is stored in.
function addMinutesWallClock(local: string, minutes: number): string | undefined {
  if (!local || !minutes) return undefined;
  const d = new Date(`${local}:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  const e = new Date(d.getTime() + minutes * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${e.getUTCFullYear()}-${p(e.getUTCMonth() + 1)}-${p(e.getUTCDate())}T${p(e.getUTCHours())}:${p(e.getUTCMinutes())}`;
}

// Staff create an appointment directly for a client (walk-in / phone client with
// no portal login). Optionally attach a service fee in the same step.
export async function createAppointmentAction(formData: FormData): Promise<void> {
  const clientId = String(formData.get("clientId") ?? "");
  const serviceKey = String(formData.get("service") ?? "").trim() || undefined;
  const title = String(formData.get("title") ?? "").trim()
    || (serviceKey ? SERVICE_LABEL[serviceKey] : "")
    || "Appointment";
  const startsAt = String(formData.get("startsAt") ?? "") || undefined;
  const lengthMin = Number(String(formData.get("lengthMin") ?? "")) || 0;
  const endsAt = startsAt ? addMinutesWallClock(startsAt, lengthMin) : undefined;
  const feeRaw = String(formData.get("fee") ?? "").trim();
  const fee = feeRaw ? Number(feeRaw) : 0;

  if (!clientId) redirect(`${NEW_APPT}?error=client`);

  const run = guardedAction("appointments.write", async (ctx) => {
    const res = await createAppointment(ctx, { clientId, title, serviceKey, startsAt, endsAt });
    if (res.ok && fee > 0) {
      await createPayment(ctx, { clientId, appointmentId: res.data.appointmentId, type: "service_fee", amount: fee });
    }
    if (res.ok) {
      await seedDefaultTasks(ctx, { appointmentId: res.data.appointmentId, clientId, serviceKey, dueAt: startsAt, assigneeId: ctx.userId });
    }
    return res;
  });
  const result = await run();

  revalidatePath("/dashboard/staff/appointments");
  if ("ok" in result && result.ok) redirect(`/dashboard/staff/appointments/${result.data.appointmentId}`);
  redirect(`${NEW_APPT}?error=failed`);
}

export async function rescheduleAppointmentAction(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const lengthMin = Number(String(formData.get("lengthMin") ?? "")) || 0;
  // Derive the end time from the chosen length; fall back to an explicit endsAt.
  const endsAt = (startsAt && lengthMin) ? addMinutesWallClock(startsAt, lengthMin) : (String(formData.get("endsAt") ?? "").trim() || undefined);
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
