// app/dashboard/staff/clients/actions.ts — staff client-management actions.
// Thin wrappers over lib/clients.ts, guarded by clients.write; RLS backstops.
"use server";

import { revalidatePath } from "next/cache";
import { guardedAction } from "@/lib/authz";
import { updateClientDetails, createBusinessClient, type ClientType } from "@/lib/clients";

export async function updateClientAction(formData: FormData): Promise<void> {
  const clientId = String(formData.get("clientId") ?? "");
  const clientType = String(formData.get("client_type") ?? "individual") as ClientType;
  const ownerRaw = String(formData.get("owner_client_id") ?? "").trim();

  const run = guardedAction(
    "clients.write",
    (ctx, args: { clientId: string }) =>
      updateClientDetails(ctx, args.clientId, {
        clientType,
        firstName: String(formData.get("first_name") ?? "").trim(),
        lastName: String(formData.get("last_name") ?? "").trim(),
        businessName: String(formData.get("business_name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        phone: String(formData.get("phone") ?? "").trim(),
        // Owner only applies to businesses; individual clears it in the lib.
        ownerClientId: clientType === "business" ? (ownerRaw || null) : null,
      }),
  );
  await run({ clientId });
  revalidatePath(`/dashboard/staff/clients/${clientId}`);
  revalidatePath("/dashboard/staff/clients");
}

export async function addBusinessAction(formData: FormData): Promise<void> {
  const ownerClientId = String(formData.get("ownerClientId") ?? "");
  const businessName = String(formData.get("business_name") ?? "").trim();
  if (!businessName) return;

  const run = guardedAction(
    "clients.write",
    (ctx, args: { ownerClientId: string; businessName: string; email?: string; phone?: string }) =>
      createBusinessClient(ctx, args),
  );
  await run({
    ownerClientId,
    businessName,
    email: String(formData.get("email") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
  });
  revalidatePath(`/dashboard/staff/clients/${ownerClientId}`);
  revalidatePath("/dashboard/staff/clients");
}
