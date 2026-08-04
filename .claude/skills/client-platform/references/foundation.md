# Minimum safe foundation

The bar every Baseline Practice OS platform must clear **before feature work begins** — including before Rosa's Request Engine (see [`../docs/adr/0001-request-engine.md`](../docs/adr/0001-request-engine.md), "Foundation gate"). It exists so a new feature builds on solid ground instead of being the thing that first introduces multi-tenancy, permissions, and isolation. The `templates/` are shipped at this bar; keep them here.

## The four pillars

### 1. Schema — org-scoped, identity split from membership
- **`organizations`** is the tenant. **Every business table carries `org_id`** from day one. A single-tenant deployment simply has one `organizations` row — the scoping is inert but present, so going multi-tenant is a filter, not a rewrite.
- **Identity vs. membership.** `profiles` is the **global person** (one row per auth user, *no* `org_id`). `memberships` says which org a person belongs to and their role there. A person may belong to more than one org. **Never** put `org_id` or a single `role` on `profiles` — that hardcodes one-org-per-person and is the expensive thing to unwind later.
- A generic **core spine**: `clients`, `engagements`, `appointments`, `documents`, `tasks`, `services`, `payments`, plus `activity_events` (append-only audit) and `notifications` (recipient-scoped) — all `org_id`-scoped. Status columns carry `CHECK` constraints (the DB rejects invalid states). Customize these per client; do not remove the scoping. (No `staff_members` table — staff are `profiles` with a staff/admin `membership`.)
- Files: `templates/supabase/001_schema.sql`, `005_activity_events.sql`, `006_notifications.sql`, `007_status_services_payments.sql`.

### 2. RLS — org-scoped policies on every table
- RLS is **enabled on every table**; a table with no policy denies all (safe default).
- Policies are backed by org-aware `security definer` helpers — `is_member(org)`, `is_staff(org)`, `is_admin(org)`, `my_client_id(org)`, `shares_org(other)` — each asking "is the caller allowed in *this row's* org?", which is naturally correct for multi-org people.
- RLS is the **backstop**, not the primary gate. It catches anything the app layer misses; it never replaces it.
- File: `templates/supabase/002_rls.sql` (+ `003_grants.sql`: RLS decides *which rows*, GRANT decides *table access at all* — both required).

### 3. Routing / authz — one source of truth
- `templates/lib/authz.ts` is the **single definition** of who-can-do-what: a capability matrix plus org/role resolution from memberships. RLS mirrors the same shape. Change the matrix, change RLS to agree — never maintain two hand-synced permission lists.
- `resolveContext()` returns the caller's `{ userId, orgId, role, memberships }`; the **role router resolves the active org and role from memberships**, not from a `profiles.role` column (see `templates/dashboard-layout.tsx`).
- The matrix is enforced at **two app-layer boundaries**, both in `authz.ts`:
  - **Per route** — a role-scoped layout calls `requireCapability(cap)` so the wrong role never renders the wrong subtree (`templates/dashboard/staff/layout.tsx` gates on `clients.read`; `templates/dashboard/client/layout.tsx` requires only context).
  - **Per action** — a server action is wrapped in `guardedAction(cap, fn)`, which resolves context and asserts the capability before the body runs, returning a typed `{ error }` on refusal (`templates/dashboard/staff/actions.ts`). Bare mutations may still call `assertCan(ctx, cap)` directly.

### 4. Verification — isolation is proven, not assumed
- `templates/supabase/tests/rls_isolation.test.sql` seeds two orgs, impersonates each org's user, and asserts **no cross-tenant row is ever visible** — then rolls back. Run it in the Supabase SQL editor after applying `001`–`003`.
- `templates/supabase/tests/activity_notifications.test.sql` proves `activity_events` is **append-only** and org-scoped, and `notifications` are **recipient-scoped** (run after `001`–`006`).
- `templates/supabase/tests/status_constraints.test.sql` proves the DB rejects invalid `appointments`/`engagements` states (run after `001`–`007`).
- `templates/supabase/tests/authz_roles.test.sql` proves the role matrix holds at the DB: within one org a `client` reads their own appointment but is **denied** INSERT appointment, INSERT task, and UPDATE appointment, while `staff` may write (run after `001`–`003`). This is the RLS mirror of the `authz.ts` matrix and the guards above.
- **`npm run verify`** runs lint + typecheck + every SQL test (`scripts/run-sql-tests.mjs`); CI (`.github/workflows/verify.yml`) runs it against a Supabase local stack. This is the **measurement** that gates the freeze — in Phase B it becomes a required check.
- Green means the boundaries hold. Do not build features until they do.

## Deployment note (tenancy)
A dedicated deployment for the first client is allowed, but it is a **topology** choice, not a data-model one: `org_id`, memberships, and org-scoped RLS ship **from day one regardless**. One shared codebase; no client-specific fork; deployment differences are configuration. The move to pooled infrastructure is triggered by documented operational thresholds (maintenance/release/backup burden, cost per tenant, proven RLS confidence), not a customer count.

## Pre-feature checklist
- [ ] `organizations` exists; every business table has `org_id`.
- [ ] `profiles` has no `org_id` / `role`; `memberships` carries org + role.
- [ ] RLS enabled on every table; org-aware helpers in place.
- [ ] `authz.ts` capability matrix defined; RLS matches it; router resolves role via memberships.
- [ ] Route guards (`requireCapability`) on role-scoped layouts and action guards (`guardedAction`) on server actions.
- [ ] `grants` applied (`authenticated` CRUD; `anon` nothing by default).
- [ ] Private storage bucket with org/client path-scoped policies.
- [ ] `activity_events` (append-only) and `notifications` (recipient-scoped) exist; delivery goes through the `lib/notifications.ts` seam.
- [ ] status columns are `CHECK`-constrained; `services` and `payments` exist.
- [ ] `npm run verify` runs green — lint + typecheck + every `*.test.sql` (`rls_isolation`, `activity_notifications`, `status_constraints`, `authz_roles`).

Only when every box is checked does a feature slice (e.g. the appointment-request Request Engine) begin.
