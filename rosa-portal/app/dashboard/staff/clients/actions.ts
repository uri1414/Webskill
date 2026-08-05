// app/dashboard/staff/clients/actions.ts — staff client-management actions.
// Thin wrappers over lib/clients.ts, guarded by clients.write; RLS backstops.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { guardedAction } from "@/lib/authz";
import { updateClientDetails, createBusinessClient, createClientRecord, type ClientType } from "@/lib/clients";

const NEW = "/dashboard/staff/clients/new";

// Create a client (and, optionally, their business in the same step), then open
// the new client's profile.
export async function createClientAction(formData: FormData): Promise<void> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const businessName = String(formData.get("business_name") ?? "").trim();

  // Need at least something to identify the client.
  if (!firstName && !lastName && !email && !businessName) redirect(`${NEW}?error=empty`);

  const run = guardedAction(
    "clients.write",
    async (ctx) => {
      const res = await createClientRecord(ctx, { firstName, lastName, email, phone });
      if (res.ok && businessName) {
        await createBusinessClient(ctx, {
          ownerClientId: res.data.id,
          businessName,
          email: String(formData.get("business_email") ?? "").trim() || undefined,
          phone: String(formData.get("business_phone") ?? "").trim() || undefined,
        });
      }
      return res;
    },
  );
  const result = await run();

  revalidatePath("/dashboard/staff/clients");
  if ("ok" in result && result.ok) redirect(`/dashboard/staff/clients/${result.data.id}`);
  redirect(`${NEW}?error=failed`);
}

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
