# Minimum safe foundation

The bar every Baseline Practice OS platform must clear **before feature work begins** — including before Rosa's Request Engine (see [`../docs/adr/0001-request-engine.md`](../docs/adr/0001-request-engine.md), "Foundation gate"). It exists so a new feature builds on solid ground instead of being the thing that first introduces multi-tenancy, permissions, and isolation. The `templates/` are shipped at this bar; keep them here.

## The four pillars

### 1. Schema — org-scoped, identity split from membership
- **`organizations`** is the tenant. **Every business table carries `org_id`** from day one. A single-tenant deployment simply has one `organizations` row — the scoping is inert but present, so going multi-tenant is a filter, not a rewrite.
- **Identity vs. membership.** `profiles` is the **global person** (one row per auth user, *no* `org_id`). `memberships` says which org a person belongs to and their role there. A person may belong to more than one org. **Never** put `org_id` or a single `role` on `profiles` — that hardcodes one-org-per-person and is the expensive thing to unwind later.
- A generic **core spine**: `clients`, `engagements`, `appointments`, `documents`, `tasks`, plus `activity_events` (append-only audit) and `notifications` (recipient-scoped) — all `org_id`-scoped. Customize these per client; do not remove the scoping.
- Files: `templates/supabase/001_schema.sql`, `005_activity_events.sql`, `006_notifications.sql`.

### 2. RLS — org-scoped policies on every table
- RLS is **enabled on every table**; a table with no policy denies all (safe default).
- Policies are backed by org-aware `security definer` helpers — `is_member(org)`, `is_staff(org)`, `is_admin(org)`, `my_client_id(org)`, `shares_org(other)` — each asking "is the caller allowed in *this row's* org?", which is naturally correct for multi-org people.
- RLS is the **backstop**, not the primary gate. It catches anything the app layer misses; it never replaces it.
- File: `templates/supabase/002_rls.sql` (+ `003_grants.sql`: RLS decides *which rows*, GRANT decides *table access at all* — both required).

### 3. Routing / authz — one source of truth
- `templates/lib/authz.ts` is the **single definition** of who-can-do-what: a capability matrix plus org/role resolution from memberships. RLS mirrors the same shape. Change the matrix, change RLS to agree — never maintain two hand-synced permission lists.
- `resolveContext()` returns the caller's `{ userId, orgId, role, memberships }`; the **role router resolves the active org and role from memberships**, not from a `profiles.role` column (see `templates/dashboard-layout.tsx`).
- Every mutation calls `assertCan(ctx, capability)` on the server before writing.

### 4. Verification — isolation is proven, not assumed
- `templates/supabase/tests/rls_isolation.test.sql` seeds two orgs, impersonates each org's user, and asserts **no cross-tenant row is ever visible** — then rolls back. Run it in the Supabase SQL editor after applying `001`–`003`.
- `templates/supabase/tests/activity_notifications.test.sql` proves `activity_events` is **append-only** and org-scoped, and `notifications` are **recipient-scoped** (run after `001`–`006`).
- Green means the boundaries hold. Do not build features until they do.

## Deployment note (tenancy)
A dedicated deployment for the first client is allowed, but it is a **topology** choice, not a data-model one: `org_id`, memberships, and org-scoped RLS ship **from day one regardless**. One shared codebase; no client-specific fork; deployment differences are configuration. The move to pooled infrastructure is triggered by documented operational thresholds (maintenance/release/backup burden, cost per tenant, proven RLS confidence), not a customer count.

## Pre-feature checklist
- [ ] `organizations` exists; every business table has `org_id`.
- [ ] `profiles` has no `org_id` / `role`; `memberships` carries org + role.
- [ ] RLS enabled on every table; org-aware helpers in place.
- [ ] `authz.ts` capability matrix defined; RLS matches it; router resolves role via memberships.
- [ ] `grants` applied (`authenticated` CRUD; `anon` nothing by default).
- [ ] Private storage bucket with org/client path-scoped policies.
- [ ] `activity_events` (append-only) and `notifications` (recipient-scoped) exist; delivery goes through the `lib/notifications.ts` seam.
- [ ] `rls_isolation.test.sql` **and** `activity_notifications.test.sql` run green.

Only when every box is checked does a feature slice (e.g. the appointment-request Request Engine) begin.
