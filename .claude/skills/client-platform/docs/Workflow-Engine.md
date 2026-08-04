# Workflow Engine — Baseline Practice OS

A **workflow** is a state-driven business process. This is how Practice OS moves an engagement from request to completion without ad-hoc `status = '...'` writes scattered across the codebase.

## The five pieces
- **State** — where an entity is (`appointments.status`, `engagements.status`).
- **Transition** — a legal move from one state to another (`confirmed → checked_in`). Illegal moves are rejected.
- **Trigger** — what starts a transition: a user action (client checks in), a schedule (start time passes with no check-in), or an event (payment succeeds).
- **Action** — side effects a transition runs: create a task, send a notification, write an activity event.
- **Guard** — a precondition that must hold for a transition to fire (deposit paid before `confirmed`; required documents received before a preparer can start).

Model transitions in one place (a `transition(entity, to, ctx)` function per workflow) so guards, actions, and audit writes are consistent — never scatter raw status updates.

## The appointment-to-completion workflow
Primary happy path (mirrors the diagram in [`Architecture.md`](./Architecture.md)):

| From | Trigger | Guard | To | Actions |
|---|---|---|---|---|
| — | client submits request | — | `requested` | create appointment; notify receptionist |
| `requested` | payment choice made | deposit paid *or* no fee required | `scheduled` → `confirmed` | create payment (if fee); write event |
| `confirmed` | receptionist preps | — | (stays `confirmed`) | create **prep task**; request documents |
| `confirmed` | client arrives | — | `checked_in` | notify preparer; write event |
| `checked_in` | preparer picks up | required docs received | `in_progress` | add to preparer **work queue**; write event |
| `in_progress` | CPA reviews & signs off | preparer marked ready | `completed` | close engagement; notify client; write event |

Each row's **Actions** always include writing an `activity_event`. Notifications are logged (see [`Automation-Patterns.md`](./Automation-Patterns.md)).

## No-show and cancellation paths
- **Cancellation** — from `requested`, `scheduled`, or `confirmed`, a client or staff can cancel → `cancelled`. Actions: release the slot, write event, notify the other party, apply the deposit/refund policy.
- **No-show** — a scheduled job whose start time passes with no `checked_in` → `no_show` (triggered by a scheduled sweep, not a user). Actions: write event, notify receptionist, optionally forfeit deposit per policy, offer reschedule (`no_show → requested`).
- Keep both as explicit off-ramps in the transition table; never let an appointment silently sit `confirmed` forever.

## Paid consultation request flow
When intake carries a consultation fee:
1. `consultation_requests.status = new` on submit (public insert).
2. Staff triage → `contacted`.
3. Client pays the consult fee → a `payments` row (`type = 'consult_fee'`, `status = paid`) and request → `scheduled`; create the appointment.
4. On conversion, request → `converted`, link `client_id` + `appointment_id`, and the appointment enters the main workflow at `confirmed`.
5. Guard: don't schedule the consult until the fee is `paid` (or explicitly waived by an admin).

## Idempotency & preventing duplicate automations
- **Guard on current state.** A transition only fires if the entity is in the expected `from` state; a second identical trigger is a no-op.
- **Dedupe side effects.** Before creating a task/notification/payment for an event, check one doesn't already exist for that `(entity_id, type)` — or use a unique constraint. A retried webhook must not create two deposits.
- **Idempotency keys.** For external calls (payments), pass a key derived from the entity so replays collapse to one.
- **One writer.** Route all status changes through the `transition()` function; nothing writes `status` directly.

## Manual overrides by admin users
- `cpa_admin` can force a transition the guards would normally block (e.g. mark `completed` without a formal review, waive a required document).
- Overrides are **first-class, not back doors**: they go through the same `transition()` path, with `override: true` + a reason, and write an activity event tagged as an override (`verb = 'status_overridden'`).
- Overrides are visible in the history so the trail stays honest. Only `cpa_admin` may override; other roles get the guarded path only.
