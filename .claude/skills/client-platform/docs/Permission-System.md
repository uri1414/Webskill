# Permission System — Baseline Practice OS

Authorization is enforced **twice**: server-side application logic (the gate) and Supabase RLS (the backstop). Never rely on one alone.

## Single-role MVP vs. `user_roles`
- **Single `profile.role`** (a `text` column, `CHECK`-constrained) — correct for a simple MVP where each person has exactly one job. Cheapest to build and reason about. Start here.
- **`user_roles` join table** — use when the system is reusable and a person may hold **multiple responsibilities** (a receptionist who is also a preparer; an owner who is also admin and preparer). Model:

  ```text
  user_roles (
    user_id  uuid references profiles(id),
    role     text,               -- 'client' | 'receptionist' | 'tax_preparer' | 'cpa_admin'
    org_id   uuid,               -- tenant scope, see below
    primary key (user_id, role, org_id)
  )
  ```

  Then permission checks ask "does this user have role X?" not "is `profile.role` == X". A `has_role(uid, role)` SQL helper backs both app logic and RLS.

Migration path: ship MVP with `profile.role`; when a second responsibility appears, add `user_roles` and backfill from `profile.role`. Design loaders to call a `roles(user)` helper so the switch is one function, not a codebase sweep.

## Roles & responsibilities
- **client** — sees only their own data: their engagements, appointments, payments, documents, notifications.
- **receptionist** — scheduling and front desk: manage appointments, check clients in, create/prep tasks, request documents, log payments. No final sign-off.
- **tax_preparer** — the work queue: engagements assigned to them, their tasks, the documents on those engagements. Cannot manage staff or practice settings.
- **cpa_admin** — everything: review/approve engagements, manual overrides, staff management, practice settings, all clients.

## Permission matrix
Legend: **R** read · **W** create/update · **—** none · **own** only their own rows.

| Capability | client | receptionist | tax_preparer | cpa_admin |
|---|---|---|---|---|
| Own profile | R/W (own) | R/W (own) | R/W (own) | R/W |
| Clients directory | own | R/W | R (assigned) | R/W |
| Appointments | R/W (own) | R/W | R (assigned) | R/W |
| Check-in | — | W | — | W |
| Engagements | R (own) | R | R/W (assigned) | R/W |
| Tasks | — | R/W | R/W (assigned) | R/W |
| Payments | R (own) + pay | R/W (log) | R (assigned) | R/W |
| Document metadata | R/W (own) | R/W | R (assigned) | R/W |
| Consultation requests | create | R/W | — | R/W |
| Notifications | own | own | own | own + R all |
| Staff management | — | — | — | R/W |
| Manual workflow override | — | — | — | W |
| Practice settings / services | — | — | — | R/W |

Treat this matrix as the source of truth for both the app-layer checks and the RLS policies — they must agree.

## Supabase RLS strategy
- **Enable RLS on every table.** A table with no policy denies all under RLS — good default.
- **Helper functions** (`security definer`, `stable`): `is_staff()`, `is_admin()` / `has_role(role)`, and `my_client_id()` (maps `auth.uid()` → `clients.id`).
- **Staff policies**: `using (is_staff())` for broad read; narrow writes to `is_admin()` or role-specific helpers where the matrix requires.
- **Client policies**: `using (client_id = my_client_id())`, and for documents also `and visibility = 'client_visible'`.
- **Public intake**: `consultation_requests` gets an `insert with check (true)` policy so anonymous web forms can submit; nothing else is public.
- RLS mirrors the matrix — it is the **backstop**, catching anything the app layer misses.

## Service-role usage & its risks
- The **service-role key bypasses RLS entirely.** It is server-only (`lib/supabase/admin.ts`), never imported into a client component, never sent to the browser, stored only as a secret env var.
- Use it **only** for deliberate privileged operations RLS can't express: creating an auth user (admin onboarding with a temp password), deleting a user with cascade + storage cleanup, system automations acting as no one.
- Every service-role call site does its **own authorization first** (confirm the caller is `cpa_admin`) — because RLS won't. A leaked service-role key is a full-database compromise; treat it like a production DB password.

## Server-side authorization for all mutations
- Every server action re-checks the caller's identity and role **on the server** before writing — never trust the client to have hidden a button.
- The pattern: load the session, resolve roles, assert the capability from the matrix, then write. If it fails, return an error; don't rely on RLS to produce a confusing failure downstream.
- RLS is defense in depth, not the primary check. The app layer gives correct, friendly authorization; RLS guarantees that even a bug can't cross a tenant or role boundary.

## Organization / tenant scoping (future multi-tenant)
- Even single-tenant today, carry an `org_id` on core tables (or design so it can be added cheaply). Scope every query and RLS policy by the caller's `org_id`.
- `has_role(uid, role, org_id)` and `my_client_id()` become org-aware; a user's membership lives in `user_roles(org_id)`.
- Done right, going multi-tenant is adding an `org_id` filter — not a rewrite. Never let one client's data be reachable without an org check.
