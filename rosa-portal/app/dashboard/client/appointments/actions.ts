// Client-side appointment actions. A client can't edit the calendar directly
// (staff own the schedule), so a reschedule/cancel is submitted as a request
// through the engine — which notifies staff. Reuses the existing "followup"
// category (no schema change); the subject makes the intent clear.
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { submitRequest } from "@/lib/requests";

const RESCHEDULE_FREE_HOURS = 48;

export async function requestRescheduleAction(formData: FormData): Promise<void> {
  const ctx = await requireContext();
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const mode = String(formData.get("mode") ?? "reschedule") === "cancel" ? "cancel" : "reschedule";
  const reason = String(formData.get("reason") ?? "").trim();
  const preferredDate = String(formData.get("preferred_date") ?? "").trim();
  const preferredTime = String(formData.get("preferred_time") ?? "").trim();
  if (!appointmentId) redirect("/dashboard/client/appointments");

  const back = `/dashboard/client/appointments/${appointmentId}`;
  const supabase = createClient();

  // Own appointment (RLS scopes to the client) + own client row.
  const { data: appt } = await supabase.from("appointments").select("title, starts_at").eq("id", appointmentId).single();
  const { data: client } = await supabase.from("clients").select("id").eq("profile_id", ctx.userId).eq("org_id", ctx.orgId).single();
  if (!appt || !client) redirect(back);

  const title = (appt.title as string) || "Appointment";
  const startsAt = appt.starts_at as string | null;
  const hoursUntil = startsAt ? (new Date(startsAt).getTime() - Date.now()) / 3_600_000 : null;
  const withinFee = hoursUntil !== null && hoursUntil < RESCHEDULE_FREE_HOURS;

  const verb = mode === "cancel" ? "Cancel" : "Reschedule";
  const subject = `${verb} request: ${title}`;
  const body = [
    `The client asked to ${mode === "cancel" ? "cancel" : "reschedule"} this appointment.`,
    startsAt ? `Current time: ${new Date(startsAt).toLocaleString()}` : "Current time: not yet set",
    mode === "reschedule" && (preferredDate || preferredTime) ? `Preferred new time: ${[preferredDate, preferredTime].filter(Boolean).join(" ")}` : null,
    reason ? `Reason: ${reason}` : null,
    withinFee
      ? `⚠ Within ${RESCHEDULE_FREE_HOURS} hours of the appointment — a late-change / no-show fee may apply.`
      : `More than ${RESCHEDULE_FREE_HOURS} hours out — no fee.`,
  ].filter(Boolean).join("\n");

  const res = await submitRequest(ctx, {
    clientId: client.id as string,
    categoryKey: "followup",
    subject,
    body,
    preferredDate: preferredDate || undefined,
    preferredTime: preferredTime || undefined,
  });
  redirect(res.ok ? `${back}?rq=ok` : `${back}?rq=err`);
}
