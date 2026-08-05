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

export async function confirmAppointmentAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Appointment";
  const startsAt = String(formData.get("startsAt") ?? "") || undefined;

  const run = guardedAction(
    "appointments.write",
    (ctx, args: { requestId: string; clientId: string; title: string; startsAt?: string }) =>
      confirmRequestAsAppointment(ctx, args.requestId, {
        clientId: args.clientId,
        title: args.title,
        startsAt: args.startsAt,
      }),
  );
  await run({ requestId, clientId, title, startsAt });
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
