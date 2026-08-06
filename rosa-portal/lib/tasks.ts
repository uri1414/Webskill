// ============================================================================
// tasks.ts — appointment preparation tasks. A lightweight operational checklist
// (NOT a project manager): each task has one owner, a due date, a status, and is
// linked to a client + appointment. Staff-only (RLS: tasks_staff). Assignment
// and completion write Activity Events so response/prep times are queryable
// later. Appointment types generate default tasks via seedDefaultTasks.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { assertCan, type Context } from "@/lib/authz";

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";

export const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "To do", in_progress: "In progress", done: "Done", blocked: "Blocked",
};
export const OPEN_TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked"];

// Default prep tasks per service — the "appointment types generate default
// tasks" automation. Starter content; easily edited (plain data, no schema).
export const DEFAULT_TASKS: Record<string, string[]> = {
  tax_prep: ["Prepare client folder", "Pull prior-year return", "Confirm documents received"],
  tax_question: ["Review the client's question beforehand"],
  business_tax: ["Prepare business folder", "Pull prior business return", "Confirm financials received"],
  bookkeeping: ["Gather statements & receipts", "Open the bookkeeping file"],
  doc_dropoff: ["Log received documents", "File into the client folder"],
  followup: ["Review notes from the last appointment"],
  business_consult: ["Prepare consultation intake", "Print entity-structure options (LLC / S-corp)"],
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function writeTaskEvent(
  supabase: ReturnType<typeof createClient>,
  ctx: Context,
  taskId: string,
  verb: string,
  to?: string,
): Promise<void> {
  await supabase.from("activity_events").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    entity_type: "task",
    entity_id: taskId,
    verb,
    from_status: null,
    to_status: to ?? null,
    metadata: {},
  });
}

export async function createTask(
  ctx: Context,
  input: { clientId?: string; appointmentId?: string; title: string; assigneeId?: string; dueAt?: string },
): Promise<Result<{ id: string }>> {
  assertCan(ctx, "tasks.write");
  if (!input.title.trim()) return { ok: false, error: "title required" };
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      org_id: ctx.orgId,
      client_id: input.clientId ?? null,
      appointment_id: input.appointmentId ?? null,
      assignee_id: input.assigneeId ?? null,
      title: input.title.trim(),
      status: "todo",
      due_at: input.dueAt ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  await writeTaskEvent(supabase, ctx, data.id as string, "created", "todo");
  return { ok: true, data: { id: data.id as string } };
}

export async function setTaskStatus(
  ctx: Context,
  taskId: string,
  status: TaskStatus,
): Promise<Result<Record<string, never>>> {
  assertCan(ctx, "tasks.write");
  const supabase = createClient();
  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await writeTaskEvent(supabase, ctx, taskId, status === "done" ? "completed" : "status_changed", status);
  return { ok: true, data: {} };
}

// Generate the default prep tasks for an appointment's service. Owner defaults
// to the booking staffer; due date to the appointment time. No-op if the service
// has no defaults.
export async function seedDefaultTasks(
  ctx: Context,
  input: { appointmentId: string; clientId: string; serviceKey?: string; dueAt?: string; assigneeId?: string },
): Promise<number> {
  const titles = input.serviceKey ? (DEFAULT_TASKS[input.serviceKey] ?? []) : [];
  for (const title of titles) {
    await createTask(ctx, {
      clientId: input.clientId,
      appointmentId: input.appointmentId,
      title,
      assigneeId: input.assigneeId,
      dueAt: input.dueAt,
    });
  }
  return titles.length;
}

// The org's staff/admin members, for an assignee picker (both memberships and
// profiles are readable by staff under RLS).
export async function listOrgStaff(orgId: string): Promise<{ id: string; name: string }[]> {
  const supabase = createClient();
  const { data: mems } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .in("role", ["staff", "admin"])
    .eq("status", "active");
  const ids = (mems ?? []).map((m) => m.user_id as string);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  return (profs ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string) || (p.email as string) || "Staff",
  }));
}
