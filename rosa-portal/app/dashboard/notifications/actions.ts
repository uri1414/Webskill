// Notification actions. The recipient can mark their own notifications read
// (RLS: notifications_own_update). Marking read updates status + read_at and
// revalidates the dashboard layout so the bell's unread count refreshes.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .neq("status", "read");

  // Refresh the header (and everything under the dashboard layout).
  revalidatePath("/dashboard", "layout");
}
