// app/dashboard/staff/tasks/actions.ts — prep-task actions. Guarded by
// tasks.write; RLS backstops. Shared by the Tasks dashboard, the appointment
// detail's Preparation card, and the staff appointment cards.
"use server";

import { revalidatePath } from "next/cache";
import { guardedAction } from "@/lib/authz";
import { createTask, setTaskStatus, type TaskStatus } from "@/lib/tasks";

export async function createTaskAction(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "") || undefined;
  const clientId = String(formData.get("clientId") ?? "") || undefined;
  const title = String(formData.get("title") ?? "").trim();
  const assigneeId = String(formData.get("assignee_id") ?? "").trim() || undefined;
  const dueAt = String(formData.get("due_at") ?? "").trim() || undefined;
  if (!title) return;

  const run = guardedAction(
    "tasks.write",
    (ctx, args: { clientId?: string; appointmentId?: string; title: string; assigneeId?: string; dueAt?: string }) =>
      createTask(ctx, args),
  );
  await run({ clientId, appointmentId, title, assigneeId, dueAt });
  if (appointmentId) revalidatePath(`/dashboard/staff/appointments/${appointmentId}`);
  revalidatePath("/dashboard/staff/appointments");
  revalidatePath("/dashboard/staff/tasks");
}

export async function setTaskStatusAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "") as TaskStatus;
  const appointmentId = String(formData.get("appointmentId") ?? "") || undefined;

  const run = guardedAction(
    "tasks.write",
    (ctx, args: { taskId: string; status: TaskStatus }) => setTaskStatus(ctx, args.taskId, args.status),
  );
  await run({ taskId, status });
  if (appointmentId) revalidatePath(`/dashboard/staff/appointments/${appointmentId}`);
  revalidatePath("/dashboard/staff/appointments");
  revalidatePath("/dashboard/staff/tasks");
}
