# Architecture Principles — Baseline Practice OS

**ADRs record decisions; principles explain how future decisions should be made.** When a new decision is ambiguous, these ten break the tie. They change rarely — a change here is itself an architectural decision (record it as an ADR). Consistent with [`../adr/0001-request-engine.md`](../adr/0001-request-engine.md).

## The principles

1. **Integrate before replacing.** Orchestrate the tools a business already runs on — Gmail, Calendly, Drake, QuickBooks — through one workflow before rebuilding them. Reach for a new engine only when orchestration genuinely can't express the need.

2. **Workflow before features.** Model the state-driven process — entities, statuses, transitions, guards — before building screens. A screen built on a wrong workflow is thrown away; a workflow you get right carries every screen.

3. **Progressive adoption.** Ship the thin vertical slice that delivers value *and* validates the boundaries, then expand on evidence. Don't design future capability in the abstract ahead of the slice that would prove it.

4. **Baseline owns workflow state; providers own delivery or specialist records until intentionally migrated.** Baseline is the system of record for status, assignment, resolution, and audit. Connected providers keep ownership of the delivery, documents, or specialist data they are responsible for — unless an intentional migration moves that boundary. (Reconciles the "system of record" question with ADR-0001.)

5. **Every meaningful action produces an Activity Event.** State changes, overrides, assignments, and conversions append to the audit log. The trail is a product feature, not a debugging aid — and it is append-only.

6. **Every workflow has a clear owner.** One engine owns each state machine and its transitions; it *consumes* the Workflow, Permission, Notification, and Integration engines rather than reimplementing them. No second transition system.

7. **Every request has one lifecycle.** A unit of work has a single authoritative state machine. No parallel or duplicate status tracking of the same thing in two places.

8. **Simplicity before configurability.** Model concretely first (named tables, typed columns). Add configuration only when real demand appears. No speculative generality, no EAV, no config-driven-everything before the second real case teaches you what's actually shared.

9. **Client experience before internal optimization.** When a client-facing clarity trades off against an internal convenience, the client wins. The portal exists to reassure the client their work is moving.

10. **Architecture must reduce cognitive load.** Boundaries, naming, and one-source-of-truth exist so a new engineer can reason about the system. Complexity that doesn't reduce load is removed, not documented around.

## How to use these

- Weighing a design choice? State which principles apply and whether they agree. If two conflict (e.g. #8 simplicity vs. a request for configurability), the lower-numbered principle usually wins — they're roughly in priority order.
- A decision that overrides a principle is significant enough to record as an ADR, with the reason.
- These guide decisions; the decisions themselves live in [`../adr/`](../adr/).
