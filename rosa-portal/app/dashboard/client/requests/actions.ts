// Client self-service action. Thin: validate the intake choice, resolve the
// caller's OWN client row server-side, and hand off to the Request Engine. The
// service reuses the category mechanism; RLS is the backstop.
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/authz";
import { submitRequest } from "@/lib/requests";
import { SERVICE_LABEL } from "@/lib/services";

const NEW = "/dashboard/client/requests/new";

export async function submitAppointmentRequestAction(formData: FormData): Promise<void> {
  const ctx = await requireContext();
  const service = String(formData.get("service") ?? "").trim();
  const otherDetail = String(formData.get("other_detail") ?? "").trim();
  const note = String(formData.get("body") ?? "").trim();
  const preferredDate = String(formData.get("preferred_date") ?? "").trim();
  const preferredTime = String(formData.get("preferred_time") ?? "").trim();

  if (!service || !SERVICE_LABEL[service]) redirect(`${NEW}?error=service`);
  if (service === "other" && !otherDetail) redirect(`${NEW}?error=other`);

  // subject = the human title: the service label, or the clarification for "Other".
  const subject = service === "other" ? otherDetail : SERVICE_LABEL[service];

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
    categoryKey: service,
    subject,
    body: note || undefined,
    preferredDate: preferredDate || undefined,
    preferredTime: preferredTime || undefined,
  });
  if (!res.ok) redirect(`${NEW}?error=submit`);
  redirect(`/dashboard/client/requests/${res.data.id}`);
}
