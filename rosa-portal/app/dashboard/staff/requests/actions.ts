// app/dashboard/staff/requests/actions.ts — staff request actions.
//
// Rosa's flow is one-step: approve a request and it becomes a confirmed
// appointment. Each action wraps a Request Engine function in guardedAction
// (resolves context + asserts the capability), then revalidates. No lifecycle
// logic here — it lives in lib/requests.ts; RLS backstops.
"use server";

import { revalidatePath } from "next/cache";
import { guardedAction } from "@/lib/authz";
import { confirmRequestAsAppointment, declineRequest } from "@/lib/requests";
import { createPayment } from "@/lib/payments";

export async function confirmAppointmentAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Appointment";
  const startsAt = String(formData.get("startsAt") ?? "") || undefined;
  const feeRaw = String(formData.get("fee") ?? "").trim();
  const fee = feeRaw ? Number(feeRaw) : 0;

  const run = guardedAction(
    "appointments.write",
    async (ctx, args: { requestId: string; clientId: string; title: string; startsAt?: string; fee: number }) => {
      const res = await confirmRequestAsAppointment(ctx, args.requestId, {
        clientId: args.clientId,
        title: args.title,
        startsAt: args.startsAt,
      });
      // Attach the service fee (if any) to the new appointment.
      if (res.ok && args.fee > 0) {
        await createPayment(ctx, {
          clientId: args.clientId,
          appointmentId: res.data.appointmentId,
          type: "service_fee",
          amount: args.fee,
        });
      }
      return res;
    },
  );
  await run({ requestId, clientId, title, startsAt, fee });
  revalidatePath(`/dashboard/staff/requests/${requestId}`);
  revalidatePath("/dashboard/staff/requests");
  revalidatePath("/dashboard/staff/appointments");
}

export async function declineRequestAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const run = guardedAction("engagements.write", (ctx, id: string) => declineRequest(ctx, id));
  await run(requestId);
  revalidatePath(`/dashboard/staff/requests/${requestId}`);
  revalidatePath("/dashboard/staff/requests");
}
