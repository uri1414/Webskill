// app/dashboard/staff/requests/actions.ts — staff lifecycle actions.
//
// Thin: each action wraps a Request Engine function in guardedAction (resolves
// context + asserts the capability before running), then revalidates. No
// lifecycle logic here — claim/convert live in lib/requests.ts; RLS backstops.
"use server";

import { revalidatePath } from "next/cache";
import { guardedAction } from "@/lib/authz";
import { claimRequest, convertRequestToAppointment } from "@/lib/requests";

export async function claimRequestAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const run = guardedAction("engagements.write", (ctx, id: string) => claimRequest(ctx, id));
  await run(requestId);
  revalidatePath(`/dashboard/staff/requests/${requestId}`);
}

export async function convertToAppointmentAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Appointment";
  const startsAt = String(formData.get("startsAt") ?? "") || undefined;

  const run = guardedAction(
    "appointments.write",
    (ctx, args: { requestId: string; clientId: string; title: string; startsAt?: string }) =>
      convertRequestToAppointment(ctx, args.requestId, {
        clientId: args.clientId,
        title: args.title,
        startsAt: args.startsAt,
      }),
  );
  await run({ requestId, clientId, title, startsAt });
  revalidatePath(`/dashboard/staff/requests/${requestId}`);
}
