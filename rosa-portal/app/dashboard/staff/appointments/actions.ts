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
