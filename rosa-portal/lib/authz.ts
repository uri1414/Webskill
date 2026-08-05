// ============================================================================
// authz.ts — single source of truth for who-can-do-what + org/role routing.
//
// The application layer (server actions, route guards, the role router) enforces
// these capabilities; Supabase RLS (supabase/002_rls.sql) mirrors the SAME shape
// as the backstop. Keep the two in agreement — this file is the definition, RLS
// is the safety net. See references/foundation.md.
//
// Identity vs. membership: a person (profile) may belong to several orgs. The
// ACTIVE org determines the role in play. RLS still guarantees a person can only
// ever read orgs they are an active member of, whatever the app requests.
// ============================================================================

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "staff" | "client";

export type Capability =
  | "clients.read" | "clients.write"
  | "engagements.read" | "engagements.write"
  | "appointments.read" | "appointments.write"
  | "payments.read" | "payments.write"
  | "documents.read" | "documents.write"
  | "tasks.read" | "tasks.write"
  | "members.manage" | "org.settings";

// The capability matrix — the one place permissions are defined. RLS policies
// are written to match this; if you change a row here, update RLS to agree.
const MATRIX: Record<Role, Capability[]> = {
  admin: [
    "clients.read", "clients.write",
    "engagements.read", "engagements.write",
    "appointments.read", "appointments.write",
    "payments.read", "payments.write",
    "documents.read", "documents.write",
    "tasks.read", "tasks.write",
    "members.manage", "org.settings",
  ],
  staff: [
    "clients.read", "clients.write",
    "engagements.read", "engagements.write",
    "appointments.read", "appointments.write",
    "payments.read", "payments.write",
    "documents.read", "documents.write",
    "tasks.read", "tasks.write",
  ],
  client: ["appointments.read", "payments.read", "documents.read"],
};

export function can(role: Role, cap: Capability): boolean {
  return MATRIX[role]?.includes(cap) ?? false;
}

export type Membership = { orgId: string; role: Role };
export type Context = {
  userId: string;
  orgId: string;        // the active org ("" if the user has no membership yet)
  role: Role;           // role in the active org
  memberships: Membership[];
};

// Resolve the caller's identity, their memberships, and the ACTIVE org.
// Active org = `activeOrgId` if the user is a member of it, else their first
// membership. Returns null when signed out.
export async function resolveContext(activeOrgId?: string): Promise<Context | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  const memberships: Membership[] = (rows ?? []).map((r) => ({
    orgId: r.org_id as string,
    role: r.role as Role,
  }));

  if (memberships.length === 0) {
    return { userId: user.id, orgId: "", role: "client", memberships };
  }
  const active = memberships.find((m) => m.orgId === activeOrgId) ?? memberships[0];
  return { userId: user.id, orgId: active.orgId, role: active.role, memberships };
}

// Route guard for a server component / layout: redirect to /login when signed
// out or when the user belongs to no org.
export async function requireContext(activeOrgId?: string): Promise<Context> {
  const ctx = await resolveContext(activeOrgId);
  if (!ctx || ctx.memberships.length === 0) redirect("/login");
  return ctx;
}

// Assert a capability inside a server action before any mutation. RLS is the
// backstop; this is the gate that returns a clean, early failure.
export function assertCan(ctx: Context, cap: Capability): void {
  if (!can(ctx.role, cap)) {
    throw new Error(`Forbidden: role "${ctx.role}" lacks capability "${cap}"`);
  }
}

// ---- Route & action guards (#16) -------------------------------------------

// Route guard for a PROTECTED layout / page: resolves context, sends signed-out
// or non-member users to /login, and bounces a member who lacks `capability`
// back to their own dashboard home — so children never render for the wrong
// role. Call it at the top of a role-scoped layout. RLS is the backstop; this
// is the gate.
export async function requireCapability(
  capability: Capability,
  activeOrgId?: string,
): Promise<Context> {
  const ctx = await requireContext(activeOrgId);
  if (!can(ctx.role, capability)) redirect("/dashboard");
  return ctx;
}

// Wrap a server action so it resolves context and asserts a capability BEFORE
// running — the app-layer gate that pairs with RLS on every mutation. Returns a
// typed error instead of throwing to the client on a permission failure.
export function guardedAction<Args extends unknown[], Result>(
  capability: Capability,
  fn: (ctx: Context, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result | { error: string }> {
  return async (...args: Args) => {
    const ctx = await resolveContext();
    if (!ctx || ctx.memberships.length === 0) return { error: "Not signed in." };
    if (!can(ctx.role, capability)) return { error: `Forbidden: ${ctx.role} lacks ${capability}.` };
    return fn(ctx, ...args);
  };
}
