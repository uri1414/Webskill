# Automation Patterns — Baseline Practice OS

Automations are the reminders, confirmations, and prep tasks that fire off workflow events. They must be **event-driven, idempotent, logged, and visible when they fail**.

## Event-driven automation pattern
- Automations react to **workflow transitions and activity events**, not to polling loops or scattered inline code.
- One place decides side effects: when `transition()` moves an entity, it emits the event; automation handlers subscribe to event types and act.
- Shape: `on(event_type) → guard → action(s) → log`. Keep each handler small and single-purpose.
- Triggers come from three sources: **user actions** (check-in), **schedules** (a nightly/near-real-time sweep for reminders and no-shows), and **external events** (payment webhook).

## The core automations
### Appointment confirmation
- On `requested → confirmed` (deposit paid or no fee): send the client a confirmation notification with date/time/location and a portal link. Log it.

### Payment reminder
- Scheduled sweep: for `payments.status = pending` past (or approaching) `due_date`, send a reminder. Dedupe so a client gets one reminder per cycle, not one per sweep.

### Receptionist folder-prep task
- On `confirmed`: create a **prep task** for the receptionist ("set up folder for {client}, {service}") tied to the appointment/engagement. Guard: don't create a duplicate if one already exists for that appointment.

### Missing-document reminders
- Scheduled: for engagements with `document_metadata` in `requested`/`needs_attention` and an approaching appointment, remind the client which documents are outstanding — **by name/category, never the content**. Stop once received.

### No-show handling
- Scheduled sweep: `confirmed` appointments whose start time has passed with no `checked_in` → `no_show`. Actions: write event, notify receptionist, apply deposit policy, offer reschedule. Runs once per appointment (guard on current state).

### Paid consultation conversion
- On consult fee `paid`: convert `consultation_requests` → `converted`, create/link the appointment, enter the main workflow. Idempotent on the request id.

## Notification logging
- Every automation that notifies **writes a `notifications` row** (recipient, type, channel, `sent_at`, and result). In-app notifications *are* that row; email/SMS log the send attempt + outcome.
- Logging gives an audit trail ("did the client get the reminder?"), enables dedupe, and surfaces failures. No fire-and-forget.

## Retry strategy
- External sends (email/SMS/payment) can fail transiently → retry with **bounded exponential backoff** (e.g. 3–5 attempts).
- Retries are **idempotent**: keyed on `(entity_id, automation_type)` or an idempotency key so a retry never double-sends or double-charges.
- After max attempts, mark the notification/automation **failed** (don't silently drop) and stop.

## Failure visibility for admins
- Failed automations are **visible to `cpa_admin`** — a surfaced list/badge of failed notifications and stuck automations, not buried in logs.
- Each failure shows what, for whom, why, and a retry action. An automation that fails silently is worse than none, because the practice believes the client was reminded.
- Stuck workflows (e.g. an engagement waiting on a document for too long) surface the same way so a human can intervene.
