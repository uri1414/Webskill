# Industry Modules — Baseline Practice OS

The core is one platform; each vertical is a **module** on top of it. This is how a CPA build becomes a clinic build without a rewrite.

## How the shared core is reused
Every module inherits, unchanged:
- identity, auth, roles / `user_roles`
- the **workflow** engine (states, transitions, guards)
- `appointments`, `payments`, `tasks`, `notifications`, `activity_events`
- portal shell, role-based nav, shared loaders, design tokens, automation framework

A module **adds** its domain tables, its role set, its service catalog, and its portal sections — and **configures** the workflow (which states, which guards). It does not fork the core.

## CPA module boundaries
- **Roles**: `client`, `receptionist`, `tax_preparer`, `cpa_admin`.
- **Domain tables**: `engagements`, `document_metadata` (or external links), `consultation_requests`.
- **Workflow**: the appointment-to-completion slice with tax-prep stages and a CPA review gate.
- **Guardrail**: organizes intake/routing/reminders/documents/queues; does **not** replace licensed tax judgment (see [`../SKILL.md`](../SKILL.md) and [`UI-Guidelines.md`](./UI-Guidelines.md)).
- Everything else (scheduling, payments, notifications, audit) is core.

## Other module sketches
Same core, different domain shape:

| Module | Client = | "engagement" = | Extra domain tables | Notable guard/flow |
|---|---|---|---|---|
| **Law firm** | client/party | matter | `matters`, conflicts check, `documents` | conflicts-check guard before opening a matter; trust-account payments |
| **Clinic** | patient | visit / care episode | `encounters`, `insurance`, clinical `documents` | insurance-eligibility guard; PHI → link/secure store, minimal retention |
| **Insurance agency** | policyholder | claim / policy application | `policies`, `claims`, `quotes` | underwriting review gate; renewal reminders |
| **Creative agency** | client | project | `projects`, `deliverables`, `contracts` | approval/sign-off gate per deliverable; milestone invoicing |
| **Contractor / trades** | homeowner | job / estimate | `jobs`, `estimates`, `site_visits` | estimate-approval + deposit guard before scheduling; crew assignment |

Each reuses roles-that-map-to (client + front desk + doer + owner), the workflow engine, and payments/notifications/audit verbatim.

## What stays in core vs. what belongs in a module
**Core** (needed by two or more industries):
- profiles/roles, appointments, payments, tasks, notifications, activity_events, workflow engine, portals, tokens, automations.

**Module** (specific to one industry):
- the domain "engagement" table and its stages, industry documents/compliance, the role names, the service catalog, industry-specific guards, and portal sections that only that vertical needs.

Litmus test: *would a clinic and a law firm both need this exact table/field?* Yes → core. No → module.

## Warning: don't over-generalize the database too early
- **Model the CPA module concretely first.** Ship one real vertical with named tables (`engagements`, not a generic `things`) before abstracting.
- Premature generalization (an EAV "flexible schema", a universal `entities` table, config-driven everything) buys imagined reuse and pays in lost type safety, unqueryable data, and slow development.
- Extract the core **after** the second module reveals what's *actually* shared — two concrete implementations teach you the abstraction; one guesses it.
- Keep the core small and boring; let modules be specific. It's cheaper to promote a field from module to core later than to unwind a wrong abstraction.
