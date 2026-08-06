// ============================================================================
// appointments.ts — Appointment lifecycle engine.
//
// The one place an appointment's status or time changes. Same Workflow-Engine
// transition() pattern as lib/requests.ts: every move is guarded by a
// capability, only fires from a legal `from` state, writes an activity_event,
// and (where it affects the client) notifies through the delivery seam. RLS
// (supabase/002_rls.sql: staff full, client read-own) is the backstop; this is
// the app gate. Appointments are born (status 'requested') when a request is
// converted — see convertRequestToAppointment in lib/requests.ts.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { assertCan, type Context } from "@/lib/authz";

export type AppointmentStatus =
  | "requested" | "scheduled" | "confirmed" | "checked_in"
  | "completed" | "cancelled" | "no_show";

// Legal moves. A transition only fires from an expected `from` state, so a
// duplicate trigger is a no-op (idempotency by current state).
const LEGAL: Record<AppointmentStatus, AppointmentStatus[]> = {
  requested:  ["scheduled", "cancelled"],
  scheduled:  ["confirmed", "checked_in", "completed", "cancelled", "no_show"],
  confirmed:  ["checked_in", "completed", "cancelled", "no_show"],
  checked_in: ["completed", "no_show"],
  completed:  [],
  cancelled:  [],
  no_show:    [],
};

// Human labels for the UI and notifications.
export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  requested:  "Requested",
  scheduled:  "Scheduled",
  confirmed:  "Confirmed",
  checked_in: "Checked in",
  completed:  "Completed",
  cancelled:  "Cancelled",
  no_show:    "No-show",
};

// Terminal states can't be acted on further.
export function isTerminal(status: AppointmentStatus): boolean {
  return LEGAL[status]?.length === 0;
}

// Which moves the UI should offer from the current state.
export function allowedTransitions(status: AppointmentStatus): AppointmentStatus[] {
  return LEGAL[status] ?? [];
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function writeEvent(
  client: SupabaseClient,
  ctx: Context,
  appointmentId: string,
  verb: string,
  from?: string,
  to?: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await client.from("activity_events").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    entity_type: "appointment",
    entity_id: appointmentId,
    verb,
    from_status: from ?? null,
    to_status: to ?? null,
    metadata,
  });
}

// Resolve the client's login (profile_id) so we can notify them in-portal.
async function clientProfileId(client: SupabaseClient, clientId: string): Promise<string | null> {
  const { data } = await client.from("clients").select("profile_id").eq("id", clientId).single();
  return (data?.profile_id as string | null) ?? null;
}

// The client sees THAT their appointment changed and links into the portal —
// sensitive detail stays out of the notification body (UI-Guidelines.md).
async function notifyClient(
  client: SupabaseClient,
  ctx: Context,
  clientId: string,
  appointmentId: string,
  type: string,
  title: string,
): Promise<void> {
  const recipientId = await clientProfileId(client, clientId);
  if (!recipientId) return; // client has no login yet — nothing to deliver
  await notify({
    orgId: ctx.orgId,
    recipientId,
    type,
    title,
    link: "/dashboard/client/appointments",
    entityType: "appointment",
    entityId: appointmentId,
  });
}

// Core transition: guard, read current state, move only if legal, audit, and
// notify the client on the changes that matter to them.
export async function transitionAppointment(
  ctx: Context,
  appointmentId: string,
  to: AppointmentStatus,
): Promise<Result<{ status: AppointmentStatus }>> {
  assertCan(ctx, "appointments.write");
  const supabase = createClient();

  const { data: current, error: readErr } = await supabase
    .from("appointments")
    .select("status, client_id")
    .eq("id", appointmentId)
    .single();
  if (readErr || !current) return { ok: false, error: readErr?.message ?? "appointment not found" };

  const from = current.status as AppointmentStatus;
  if (from === to) return { ok: true, data: { status: to } }; // idempotent no-op
  if (!LEGAL[from]?.includes(to)) {
    return { ok: false, error: `illegal transition ${from} -> ${to}` };
  }

  const { error: updErr } = await supabase
    .from("appointments")
    .update({ status: to })
    .eq("id", appointmentId)
    .eq("status", from); // optimistic guard: only move from the state we read
  if (updErr) return { ok: false, error: updErr.message };

  await writeEvent(supabase, ctx, appointmentId, "status_changed", from, to);

  const clientId = current.client_id as string;
  if (to === "confirmed") {
    await notifyClient(supabase, ctx, clientId, appointmentId, "appointment_confirmed",
      "Your appointment is confirmed");
  } else if (to === "cancelled") {
    await notifyClient(supabase, ctx, clientId, appointmentId, "appointment_cancelled",
      "Your appointment was cancelled");
  }

  return { ok: true, data: { status: to } };
}

// Set or change the appointment time. Setting a time on a still-'requested'
// appointment also schedules it (requested -> scheduled) so the queue reflects
// that it now has a slot. The client is notified their time was set/updated.
export async function rescheduleAppointment(
  ctx: Context,
  appointmentId: string,
  startsAt: string,
  endsAt?: string,
): Promise<Result<{ status: AppointmentStatus }>> {
  assertCan(ctx, "appointments.write");
  const supabase = createClient();

  const { data: current, error: readErr } = await supabase
    .from("appointments")
    .select("status, client_id, starts_at")
    .eq("id", appointmentId)
    .single();
  if (readErr || !current) return { ok: false, error: readErr?.message ?? "appointment not found" };

  const from = current.status as AppointmentStatus;
  if (isTerminal(from)) return { ok: false, error: `cannot reschedule a ${from} appointment` };

  const wasUnset = !current.starts_at;
  const nextStatus: AppointmentStatus = from === "requested" ? "scheduled" : from;

  const { error: updErr } = await supabase
    .from("appointments")
    .update({ starts_at: startsAt, ends_at: endsAt ?? null, status: nextStatus })
    .eq("id", appointmentId);
  if (updErr) return { ok: false, error: updErr.message };

  await writeEvent(supabase, ctx, appointmentId, wasUnset ? "scheduled" : "rescheduled",
    from, nextStatus, { starts_at: startsAt });

  await notifyClient(supabase, ctx, current.client_id as string, appointmentId,
    "appointment_scheduled",
    wasUnset ? "Your appointment has been scheduled" : "Your appointment time was updated");

  return { ok: true, data: { status: nextStatus } };
}

// Staff action: create an appointment directly for a client (no request needed).
// This is how Rosa books for walk-ins / phone clients who have no portal login.
// Born 'confirmed'; seeds the timeline and notifies the client IF they have a
// login (a record-only client simply isn't notified).
export async function createAppointment(
  ctx: Context,
  input: { clientId: string; title: string; serviceKey?: string; startsAt?: string; endsAt?: string },
): Promise<Result<{ appointmentId: string }>> {
  assertCan(ctx, "appointments.write");
  const supabase = createClient();

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      org_id: ctx.orgId,
      client_id: input.clientId,
      title: input.title,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      service_key: input.serviceKey ?? null,
      status: "confirmed",
      staff_id: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !appointment) return { ok: false, error: error?.message ?? "appointment insert failed" };
  const appointmentId = appointment.id as string;

  await writeEvent(supabase, ctx, appointmentId, "status_changed", undefined, "confirmed");
  await notifyClient(supabase, ctx, input.clientId, appointmentId,
    "appointment_confirmed", "Your appointment is confirmed");

  return { ok: true, data: { appointmentId } };
}
