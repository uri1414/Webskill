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
import { seedDefaultTasks } from "@/lib/tasks";

// Add minutes to a wall-clock "YYYY-MM-DDTHH:MM" value, keeping the same
// wall-clock convention starts_at is stored in (interpret + format as UTC).
function addMinutesWallClock(local: string, minutes: number): string | undefined {
  if (!local || !minutes) return undefined;
  const d = new Date(`${local}:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  const e = new Date(d.getTime() + minutes * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${e.getUTCFullYear()}-${p(e.getUTCMonth() + 1)}-${p(e.getUTCDate())}T${p(e.getUTCHours())}:${p(e.getUTCMinutes())}`;
}

export async function confirmAppointmentAction(formData: FormData): Promise<void> {
  const requestId = String(formData.get("requestId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || "Appointment";
  const startsAt = String(formData.get("startsAt") ?? "") || undefined;
  const serviceKey = String(formData.get("categoryKey") ?? "").trim() || undefined;
  const lengthMin = Number(String(formData.get("lengthMin") ?? "")) || 0;
  const endsAt = startsAt ? addMinutesWallClock(startsAt, lengthMin) : undefined;
  const feeRaw = String(formData.get("fee") ?? "").trim();
  const fee = feeRaw ? Number(feeRaw) : 0;

  const run = guardedAction(
    "appointments.write",
    async (ctx, args: { requestId: string; clientId: string; title: string; startsAt?: string; endsAt?: string; serviceKey?: string; fee: number }) => {
      const res = await confirmRequestAsAppointment(ctx, args.requestId, {
        clientId: args.clientId,
        title: args.title,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        serviceKey: args.serviceKey,
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
      // Generate default prep tasks for the service (owner = the booking staffer).
      if (res.ok) {
        await seedDefaultTasks(ctx, {
          appointmentId: res.data.appointmentId,
          clientId: args.clientId,
          serviceKey: args.serviceKey,
          dueAt: args.startsAt,
          assigneeId: ctx.userId,
        });
      }
      return res;
    },
  );
  await run({ requestId, clientId, title, startsAt, endsAt, serviceKey, fee });
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
