// ============================================================================
// clients.ts — staff-side client management (edit details, type, and the
// business↔owner link). Staff-only (RLS: clients_staff). A business record is
// just a client row with client_type='business' and owner_client_id pointing at
// the owner's personal client row; it has no login (no profile_id).
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { assertCan, type Context } from "@/lib/authz";

export type ClientType = "individual" | "business";

export const CLIENT_TYPE_LABEL: Record<string, string> = {
  individual: "Individual",
  business: "Business",
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Update editable client details. Only provided fields change. Marking a client
// 'individual' clears any owner link (owners are for businesses).
export async function updateClientDetails(
  ctx: Context,
  clientId: string,
  patch: {
    clientType?: ClientType;
    firstName?: string | null;
    lastName?: string | null;
    businessName?: string | null;
    email?: string | null;
    phone?: string | null;
    ownerClientId?: string | null;
  },
): Promise<Result<Record<string, never>>> {
  assertCan(ctx, "clients.write");
  const supabase = createClient();

  const update: Record<string, unknown> = {};
  if (patch.clientType !== undefined) update.client_type = patch.clientType;
  if (patch.firstName !== undefined) update.first_name = patch.firstName || null;
  if (patch.lastName !== undefined) update.last_name = patch.lastName || null;
  if (patch.businessName !== undefined) update.business_name = patch.businessName || null;
  if (patch.email !== undefined) update.email = patch.email || null;
  if (patch.phone !== undefined) update.phone = patch.phone || null;
  // An individual can't own itself / carry an owner link.
  if (patch.clientType === "individual") update.owner_client_id = null;
  else if (patch.ownerClientId !== undefined) update.owner_client_id = patch.ownerClientId || null;

  const { error } = await supabase.from("clients").update(update).eq("id", clientId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: {} };
}

// Staff create a new client record directly (a walk-in / known client who
// hasn't signed up). No profile_id — they have no login yet; it's a record Rosa
// manages. An invite-to-portal flow can attach a login later.
export async function createClientRecord(
  ctx: Context,
  input: { firstName?: string; lastName?: string; email?: string; phone?: string },
): Promise<Result<{ id: string }>> {
  assertCan(ctx, "clients.write");
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      org_id: ctx.orgId,
      client_type: "individual",
      first_name: input.firstName || null,
      last_name: input.lastName || null,
      email: input.email || null,
      phone: input.phone || null,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
  return { ok: true, data: { id: data.id as string } };
}

// Create a business client linked to an owner (their personal record). This is
// how a business profile gets "attached" to a person.
export async function createBusinessClient(
  ctx: Context,
  input: { ownerClientId: string; businessName: string; email?: string; phone?: string },
): Promise<Result<{ id: string }>> {
  assertCan(ctx, "clients.write");
  if (!input.businessName.trim()) return { ok: false, error: "business name required" };
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      org_id: ctx.orgId,
      client_type: "business",
      business_name: input.businessName.trim(),
      email: input.email || null,
      phone: input.phone || null,
      owner_client_id: input.ownerClientId,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
  return { ok: true, data: { id: data.id as string } };
}
