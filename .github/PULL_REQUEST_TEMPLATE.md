<!--
  Foundation Merge Gate — see .claude/skills/client-platform/docs/adr/0002-foundation-green-gate.md.
  Fill in the summary, then complete the checklist that matches your change.
-->

## Summary

<!-- What does this PR do, and why? One or two sentences. -->

## Change surface

Tick the one that applies — it decides which gate you're on:

- [ ] **Presentation-only** (styling, copy, a client-specific page). Rides the **baseline** gate (`npm run verify`); the foundation tier does **not** apply.
- [ ] **Touches a foundation-scoped path** — any of `templates/supabase/**`, `lib/authz.ts`, `lib/*-data.ts`, RLS / workflow / shared-core. The **Foundation Complete** tier applies (below).

## Baseline (every PR in an assembled app)

- [ ] `npm run verify` is green (lint · typecheck · SQL tests), or N/A because this repo is the skills library (no assembled app).

## Foundation Complete (only if you ticked the scoped-path box)

- [ ] `foundation-db-tests` is green on this branch (link the run): <!-- run URL -->
- [ ] If I changed the capability matrix in `authz.ts`, I changed **RLS** to agree in this same PR, and `authz_roles.test.sql` still passes.
- [ ] Any new business table carries `org_id`, ships with an RLS policy, and I did **not** add `org_id`/`role` to `profiles`.
- [ ] If I weakened a foundation invariant (tenant isolation, append-only audit, recipient-scoped notifications, status constraints), there is an **ADR** for it — this is not an incidental change.

## Notes

<!-- Anything a reviewer needs: deferred work, follow-ups, provisional decisions. -->
