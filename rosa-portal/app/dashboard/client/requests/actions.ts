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
  // A visit can cover several services — the form is multi-select.
  const services = formData.getAll("services").map((s) => String(s).trim()).filter((s) => SERVICE_LABEL[s]);
  const otherDetail = String(formData.get("other_detail") ?? "").trim();
  const note = String(formData.get("body") ?? "").trim();
  const preferredDate = String(formData.get("preferred_date") ?? "").trim();
  const preferredTime = String(formData.get("preferred_time") ?? "").trim();

  if (services.length === 0) redirect(`${NEW}?error=service`);
  if (services.includes("other") && !otherDetail) redirect(`${NEW}?error=other`);

  // Human title: each service's label, with the clarification standing in for
  // "Other". The primary category (first pick) drives routing + the prep list;
  // the full set is preserved in the subject and appended to the note so staff
  // sees everything without a schema change.
  const labels = services.map((s) => (s === "other" ? otherDetail : SERVICE_LABEL[s]));
  const subject = labels.join(", ");
  const primary = services[0];
  const servicesLine = services.length > 1 ? `Requested services: ${labels.join(", ")}` : "";
  const body = [servicesLine, note].filter(Boolean).join("\n\n");

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
    categoryKey: primary,
    subject,
    body: body || undefined,
    preferredDate: preferredDate || undefined,
    preferredTime: preferredTime || undefined,
  });
  if (!res.ok) redirect(`${NEW}?error=submit`);
  redirect(`/dashboard/client/requests/${res.data.id}`);
}
