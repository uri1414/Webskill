// ============================================================================
// requests.ts — Request Engine lifecycle (Rosa Appointment Request slice).
//
// The Request Engine orchestrates; it does not own the professional work. This
// module is the ONE place a request's status changes — the Workflow-Engine
// transition() pattern applied to `requests`: every move is guarded, writes an
// activity_event, and (where relevant) notifies through the delivery seam. The
// DB mirrors these rules in RLS (supabase/008_requests.sql); this is the app
// gate, RLS is the backstop. See docs/adr/0001-request-engine.md and
// docs/Workflow-Engine.md.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { assertCan, type Context } from "@/lib/authz";

export type RequestStatus =
  | "new" | "routed" | "in_progress" | "waiting_on_client"
  | "resolved" | "closed" | "no_action" | "spam";

export type Resolution = "answered" | "converted" | "duplicate" | "no_action" | "spam";

// Legal moves. A transition only fires from an expected `from` state, so a
// duplicate trigger is a no-op (idempotency by current state).
const LEGAL: Record<RequestStatus, RequestStatus[]> = {
  new:               ["routed", "no_action", "spam"],
  routed:            ["in_progress", "no_action", "spam"],
  in_progress:       ["waiting_on_client", "resolved", "no_action"],
  waiting_on_client: ["in_progress", "resolved"],
  resolved:          ["closed", "in_progress"], // reopen if the client replies
  closed:            [],
  no_action:         [],
  spam:              [],
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Append one audit row as the caller. RLS on activity_events permits a member
// to append for their own org as themselves; the routing event is written in
// SQL by route_request (009), not here.
async function writeEvent(
  client: SupabaseClient,
  ctx: Context,
  requestId: string,
  verb: string,
  from?: string,
  to?: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await client.from("activity_events").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    entity_type: "request",
    entity_id: requestId,
    verb,
    from_status: from ?? null,
    to_status: to ?? null,
    metadata,
  });
}

// Core transition: guard on current state, write the new state, audit it. All
// status changes route through here — nothing writes requests.status directly.
export async function transitionRequest(
  ctx: Context,
  requestId: string,
  to: RequestStatus,
  patch: Partial<{ assignedUserId: string; assignedRole: string; resolution: Resolution }> = {},
): Promise<Result<{ status: RequestStatus }>> {
  assertCan(ctx, "engagements.write"); // staff-level capability gates the lifecycle
  const supabase = createClient();

  const { data: current, error: readErr } = await supabase
    .from("requests")
    .select("status")
    .eq("id", requestId)
    .single();
  if (readErr || !current) return { ok: false, error: readErr?.message ?? "request not found" };

  const from = current.status as RequestStatus;
  if (from === to) return { ok: true, data: { status: to } }; // idempotent no-op
  if (!LEGAL[from]?.includes(to)) {
    return { ok: false, error: `illegal transition ${from} -> ${to}` };
  }

  const { error: updErr } = await supabase
    .from("requests")
    .update({
      status: to,
      ...(patch.assignedUserId !== undefined ? { assigned_user_id: patch.assignedUserId } : {}),
      ...(patch.assignedRole !== undefined ? { assigned_role: patch.assignedRole } : {}),
      ...(patch.resolution !== undefined ? { resolution: patch.resolution } : {}),
    })
    .eq("id", requestId)
    .eq("status", from); // optimistic guard: only move from the state we read
  if (updErr) return { ok: false, error: updErr.message };

  await writeEvent(supabase, ctx, requestId, "status_changed", from, to, patch);
  return { ok: true, data: { status: to } };
}

// Client action: submit a request. The INSERT runs as the client (RLS enforces
// client_id = my own + status new). ROUTING (new -> routed) is a SYSTEM step —
// a client cannot update requests under RLS — so it runs through the
// `route_request` SECURITY DEFINER function (supabase/009_route_request.sql),
// which authorizes the caller in-SQL, bumps the status, and writes the "routed"
// audit event atomically. No service-role client in app code. The UI never does
// either; it just calls this.
export async function submitRequest(
  ctx: Context,
  input: {
    clientId: string;
    categoryKey: string;
    subject: string;
    body?: string;
    preferredDate?: string;
    preferredTime?: string;
  },
): Promise<Result<{ id: string }>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("requests")
    .insert({
      org_id: ctx.orgId,
      client_id: input.clientId,
      category_key: input.categoryKey,
      subject: input.subject,
      body: input.body ?? null,
      preferred_date: input.preferredDate ?? null,
      preferred_time: input.preferredTime ?? null,
      status: "new",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  const id = data.id as string;
  await writeEvent(supabase, ctx, id, "created", undefined, "new", { category: input.categoryKey });

  // Route new -> routed in the database (definer function; app never bypasses RLS).
  const { error: routeErr } = await supabase.rpc("route_request", { p_request_id: id });
  if (routeErr) return { ok: false, error: routeErr.message };

  return { ok: true, data: { id } };
}

// Staff action: claim a routed request (routed -> in_progress, assign self).
export async function claimRequest(ctx: Context, requestId: string): Promise<Result<{ status: RequestStatus }>> {
  return transitionRequest(ctx, requestId, "in_progress", { assignedUserId: ctx.userId });
}

// Staff action: the ONE v1 conversion path — Appointment Request -> Appointment.
// Create the appointment, link it to the request (idempotent via the unique
// relation key), resolve the request as `converted`, and notify the client.
export async function convertRequestToAppointment(
  ctx: Context,
  requestId: string,
  appt: { clientId: string; title: string; startsAt?: string; endsAt?: string },
): Promise<Result<{ appointmentId: string }>> {
  assertCan(ctx, "appointments.write");
  const supabase = createClient();

  const { data: appointment, error: apptErr } = await supabase
    .from("appointments")
    .insert({
      org_id: ctx.orgId,
      client_id: appt.clientId,
      title: appt.title,
      starts_at: appt.startsAt ?? null,
      ends_at: appt.endsAt ?? null,
      status: "requested",
    })
    .select("id")
    .single();
  if (apptErr || !appointment) return { ok: false, error: apptErr?.message ?? "appointment insert failed" };

  const appointmentId = appointment.id as string;

  const { error: relErr } = await supabase
    .from("request_relations")
    .insert({
      org_id: ctx.orgId,
      request_id: requestId,
      entity_type: "appointment",
      entity_id: appointmentId,
      relation: "converted_to",
    });
  // a duplicate conversion collapses to the existing link (unique key) — not an error
  if (relErr && !/duplicate key/i.test(relErr.message)) return { ok: false, error: relErr.message };

  const resolved = await transitionRequest(ctx, requestId, "resolved", { resolution: "converted" });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  await writeEvent(supabase, ctx, requestId, "converted", undefined, undefined, {
    entity_type: "appointment",
    entity_id: appointmentId,
  });

  // Notify the client THAT an appointment was created — detail stays in the portal.
  const { data: client } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", appt.clientId)
    .single();
  if (client?.profile_id) {
    await notify({
      orgId: ctx.orgId,
      recipientId: client.profile_id as string,
      type: "appointment_created",
      title: "Your appointment request was accepted",
      link: `/dashboard/client/requests/${requestId}`,
      entityType: "appointment",
      entityId: appointmentId,
    });
  }

  return { ok: true, data: { appointmentId } };
}

// Staff action: the ONE-STEP approve. Rosa's flow is simple — every request is
// an appointment she just approves — so this collapses claim + convert +
// schedule + confirm into a single move: create the appointment already
// CONFIRMED at the chosen time, link it, resolve the request, and tell the
// client it's confirmed. The request lifecycle stays legal by stepping through
// in_progress internally (routed -> in_progress -> resolved); the audit trail is
// identical to doing it by hand, it just happens in one action.
export async function confirmRequestAsAppointment(
  ctx: Context,
  requestId: string,
  appt: { clientId: string; title: string; startsAt?: string; endsAt?: string; serviceKey?: string },
): Promise<Result<{ appointmentId: string }>> {
  assertCan(ctx, "appointments.write");
  const supabase = createClient();

  // Take ownership first so resolving is a legal transition (routed -> in_progress).
  await transitionRequest(ctx, requestId, "in_progress", { assignedUserId: ctx.userId });

  const { data: appointment, error: apptErr } = await supabase
    .from("appointments")
    .insert({
      org_id: ctx.orgId,
      client_id: appt.clientId,
      title: appt.title,
      starts_at: appt.startsAt ?? null,
      ends_at: appt.endsAt ?? null,
      service_key: appt.serviceKey ?? null,   // drives the client's "what to bring" list
      status: "confirmed",       // approved in one step — no separate confirm
      staff_id: ctx.userId,
    })
    .select("id")
    .single();
  if (apptErr || !appointment) return { ok: false, error: apptErr?.message ?? "appointment insert failed" };
  const appointmentId = appointment.id as string;

  const { error: relErr } = await supabase
    .from("request_relations")
    .insert({
      org_id: ctx.orgId,
      request_id: requestId,
      entity_type: "appointment",
      entity_id: appointmentId,
      relation: "converted_to",
    });
  if (relErr && !/duplicate key/i.test(relErr.message)) return { ok: false, error: relErr.message };

  const resolved = await transitionRequest(ctx, requestId, "resolved", { resolution: "converted" });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  await writeEvent(supabase, ctx, requestId, "converted", undefined, undefined, {
    entity_type: "appointment", entity_id: appointmentId, confirmed: true,
  });
  // Seed the appointment's OWN timeline (entity_type 'appointment', not 'request').
  await supabase.from("activity_events").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    entity_type: "appointment",
    entity_id: appointmentId,
    verb: "status_changed",
    from_status: null,
    to_status: "confirmed",
    metadata: {},
  });

  const { data: client } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", appt.clientId)
    .single();
  if (client?.profile_id) {
    await notify({
      orgId: ctx.orgId,
      recipientId: client.profile_id as string,
      type: "appointment_confirmed",
      title: "Your appointment is confirmed",
      link: "/dashboard/client/appointments",
      entityType: "appointment",
      entityId: appointmentId,
    });
  }

  return { ok: true, data: { appointmentId } };
}

// Staff action: decline a request (no appointment). Marks it no_action; legal
// from new / routed / in_progress.
export async function declineRequest(
  ctx: Context,
  requestId: string,
): Promise<Result<{ status: RequestStatus }>> {
  return transitionRequest(ctx, requestId, "no_action");
}
