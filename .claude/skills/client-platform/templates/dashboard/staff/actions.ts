// app/dashboard/staff/actions.ts — example server actions, each gated at the
// action boundary (#16).
//
// guardedAction wraps a mutation so it resolves context and asserts a capability
// BEFORE the body runs, returning a typed { error } instead of throwing to the
// client on a permission failure. This is the per-action gate that pairs with
// RLS: even if a page rendered for the wrong role, the action still refuses.
// The capability strings here MUST match the matrix in lib/authz.ts, which RLS
// mirrors — one definition, enforced in three places (route, action, database).
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guardedAction } from "@/lib/authz";

// Create an appointment. Requires `appointments.write` (staff/admin only). A
// client calling this gets { error: "Forbidden: client lacks appointments.write." }
// at the app layer, and RLS would refuse the INSERT even if that gate were bypassed.
export const createAppointment = guardedAction(
  "appointments.write",
  async (ctx, input: { clientId: string; serviceId: string; scheduledAt: string }) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        org_id: ctx.orgId,
        client_id: input.clientId,
        service_id: input.serviceId,
        scheduled_at: input.scheduledAt,
        status: "requested",
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/dashboard/staff/appointments");
    return { id: data.id as string };
  },
);

// Assign a task to a staff member. Requires `tasks.write` (staff/admin only).
export const createTask = guardedAction(
  "tasks.write",
  async (ctx, input: { engagementId: string; title: string; assigneeId?: string }) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        org_id: ctx.orgId,
        engagement_id: input.engagementId,
        title: input.title,
        assignee_id: input.assigneeId ?? null,
        status: "open",
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/dashboard/staff/tasks");
    return { id: data.id as string };
  },
);
