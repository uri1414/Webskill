// app/dashboard/client/requests/actions.ts — client self-service action.
//
// Thin: resolve the caller, find THEIR OWN client row server-side (never trust a
// client-supplied id), and hand off to the Request Engine. All lifecycle/routing
// logic lives in lib/requests.ts; RLS is the backstop (a client can only insert
// their own request, in the 'new' state).
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { submitRequest } from "@/lib/requests";

export async function submitAppointmentRequestAction(formData: FormData): Promise<void> {
  const ctx = await requireContext();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject) redirect("/dashboard/client/requests/new?error=subject");

  // The caller's own client row in the active org — the only id we'll trust.
  const supabase = createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", ctx.userId)
    .eq("org_id", ctx.orgId)
    .single();
  if (!client) redirect("/dashboard/client?error=no_client");

  const res = await submitRequest(ctx, {
    clientId: client!.id as string,
    categoryKey: "appointment",
    subject,
    body: body || undefined,
  });
  if (!res.ok) redirect("/dashboard/client/requests/new?error=submit");
  redirect(`/dashboard/client/requests/${res.data.id}`);
}
