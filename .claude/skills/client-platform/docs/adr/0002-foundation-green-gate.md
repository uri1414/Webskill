# ADR-0002 — Definition of Green & the Foundation Merge Gate

- **Status:** Accepted. Phase B governance. Phase A of the foundation punch-list is closed and CI-green; this ADR locks the freeze so future features build on it instead of eroding it.
- **Date:** 2026-08-04
- **Deciders:** Lead Architect (Baseline Studio); foundation governance review.
- **Related:** [`0001-request-engine.md`](./0001-request-engine.md) ("Foundation gate"), [`../architecture/principles.md`](../architecture/principles.md), [`../../references/foundation.md`](../../references/foundation.md), tracker issue #21.
- **Process:** ADR-0001 paused feature work behind a "minimum safe foundation." That foundation is now built and verified. This ADR defines **what "green" means**, **how the gate is enforced**, and **what freezing it commits us to** — the prerequisites for the Rosa Appointment Request slice.

## Context

"Foundation Complete (v1.0)" has been an informal checkpoint (tracker #21). Informal is not enough: the whole point is that *Requests, Tasks, AI, Messaging, and every later feature* must find the foundation green before they merge, and must not be the change that quietly breaks tenant isolation, the identity/membership split, or the capability matrix. That guarantee needs a **precise, machine-checked definition of green** and a **merge gate that can't be forgotten** — not a checklist someone remembers to run.

Phase A delivered the substance: org-scoped schema, RLS on every table, the `authz.ts` capability matrix with route/action guards, and four SQL tests that run against a real Supabase stack in CI. What remains is governance: name the bar, wire the gate, freeze.

## Decision

### 1. Definition of "green"

The foundation is **green** at a commit when **all** of the following pass:

| Check | Where | Proves |
|---|---|---|
| `rls_isolation.test.sql` | `foundation-db-tests` CI | one org cannot read another's rows |
| `activity_notifications.test.sql` | `foundation-db-tests` CI | `activity_events` append-only + org-scoped; `notifications` recipient-scoped |
| `status_constraints.test.sql` | `foundation-db-tests` CI | the DB rejects invalid appointment/engagement states |
| `authz_roles.test.sql` | `foundation-db-tests` CI | within one org, a `client` is denied staff-only writes; `staff` may write |
| `lint` + `typecheck` (`npm run verify`) | assembled app CI | the app-layer guards compile and pass lint |

The first four run today on every push touching `templates/supabase/**` (workflow `.github/workflows/foundation-db-tests.yml`). The fifth runs the first time an app is assembled from the templates — the `templates/` are deliberately fragments whose `@/…` aliases only resolve inside an app, so running `tsc`/`next lint` against the bare skills library is a false red, not a signal (see #19). "Green" is therefore **the SQL tier now**, plus **the app tier from the first feature slice onward**.

### 2. The gate is two tiers, scoped by path

So the gate never causes false coupling between unrelated changes:

- **Baseline — `npm run verify` green:** required on **every** PR in an assembled app.
- **Foundation Complete — green:** the **additional** requirement, **auto-applied by the paths a PR touches**: `**/templates/supabase/**`, `**/lib/authz.ts`, `**/lib/*-data.ts`, and anything RLS / workflow / shared-core. A presentation-only PR (styling, copy, a client-specific page) rides the baseline and is **not** gated on the foundation checks. A PR that touches a scoped path **must** show `foundation-db-tests` green before merge.

This is the mechanism behind principle "the foundation is a gate, not a suggestion": the gate attaches itself by what you changed, not by anyone remembering to ask.

### 3. Enforcement (required check + branch protection)

`foundation-db-tests` becoming a **required status check** on the protected branch is what turns a green run from *informational* into a *gate*. Wiring it is a repo-admin action (GitHub API / Settings), captured in the runbook below rather than in code. Until it is required, the gate is advisory.

### 4. The freeze and the tag

When the definition of green holds and the runbook steps are applied, the foundation is **frozen** and the commit is tagged **`v1.0-foundation`**. The tag is the reference point every future ADR and feature cites as "the foundation I built on." Freezing does **not** mean the foundation can never change — it means changes to it are deliberate, ADR-recorded, and re-verified, never incidental.

## What "frozen" commits us to

1. Changes to a scoped path require the foundation checks green — no exceptions merged red.
2. Changing the capability matrix in `authz.ts` requires changing RLS to agree in the same PR (they are one definition in two enforcement layers; `authz_roles.test.sql` is the check that they still agree).
3. New business tables carry `org_id`, ship with an RLS policy, and never put `org_id`/`role` on `profiles`.
4. A weakening of an invariant (isolation, append-only audit, recipient-scoping, status constraints) is a foundation change: it needs an ADR, not just a green diff.

## Runbook — repo-admin steps to enforce the gate

These are **operator actions** (they need repo-admin rights and are done once):

1. **Make the check required.** Settings → Branches → add a branch protection rule for the integration branch (or `main` once the foundation merges) → *Require status checks to pass before merging* → select **`foundation-db-tests / db-tests`**. Optionally *Require branches to be up to date before merging*.
2. **Require a PR + review** on that branch so the template and checks can't be bypassed by a direct push.
3. **(When an app exists)** add its `verify` job (lint + typecheck + SQL) as a second required check, per the definition of green.
4. **Cut the tag** once 1–2 are in place and the branch is at a green commit:

   ```bash
   git fetch origin
   git tag -a v1.0-foundation <green-commit-sha> -m "Foundation Complete (v1.0): org-scoped schema, RLS, authz matrix + guards, 4 SQL tests green"
   git push origin v1.0-foundation
   ```

The MCP tooling used to author this branch cannot set branch protection or create tags; steps 1–4 are the human-in-the-loop part of Phase B. Everything else in Phase B (this ADR, the PR template) is in the branch.

## Consequences

### Positive

- "Green" stops being a matter of memory: the gate attaches by path and blocks red merges automatically.
- Future features inherit a proven foundation and a single, testable definition of correctness.
- The `authz.ts` ⇄ RLS agreement is continuously enforced by `authz_roles.test.sql`, so the two can't silently drift.

### Costs / risks (and mitigations)

- A required check can block an urgent unrelated fix → mitigated by **path scoping**: presentation-only PRs are never gated on the foundation tier.
- The app-layer (lint/typecheck) tier can't be green until an app exists → accepted and scoped: the SQL tier is the meaningful half now; the app tier lands with the first slice (#19).
- Branch protection lives in repo settings, outside version control → mitigated by recording the exact steps in this ADR's runbook so the state is reproducible.

## Directive

Apply the runbook, tag `v1.0-foundation`, then — and only then — begin the Rosa Appointment Request slice on top of the frozen foundation. Any change that touches a scoped path from here on carries the foundation checks with it.
