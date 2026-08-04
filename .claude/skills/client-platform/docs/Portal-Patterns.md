# Portal Patterns — Baseline Practice OS

A **portal** is a role-specific experience. Four portals share one shell, one auth, and one data spine; each shows only what its role needs.

## Portal responsibilities

### Client portal
- See my engagements and their current stage (a timeline, not a raw status word).
- Book/request appointments; see upcoming and past.
- Pay deposits/fees; see payment history.
- Upload or link required documents; see what's still outstanding.
- Receive notifications and messages.
- One job: give the client confidence their work is moving. No practice internals.

### Receptionist portal
- **Day view**: who's coming in, when, with whom, and their status.
- Schedule, reschedule, cancel; check clients in.
- Prep tasks: set up folders, request documents, ready the next appointment.
- Log payments taken at the desk.
- Triage `consultation_requests`.
- One job: run the front desk smoothly.

### Tax preparer portal
- **Work queue**: engagements assigned to me, ordered by priority/due.
- Per-engagement: the client's documents, tasks, and notes.
- Move work `in_progress → ready for review`; flag missing documents.
- One job: do the work without hunting for context.

### CPA / admin portal
- Everything: all clients, engagements, staff, payments, settings.
- Review & approve engagements; manual workflow overrides (with reason).
- Practice analytics; manage `services`, staff, and roles.
- See automation/notification failures ([`Automation-Patterns.md`](./Automation-Patterns.md)).
- One job: oversee the practice and handle exceptions.

## Shared loader pattern
- **One loader per role**: `lib/<role>-data.ts` exporting `load<Role>()` that returns `{ user, profile, ...entities }` plus a `derive()` for computed values (current stage, totals, buckets).
- Every section in that portal imports the same loader → the whole portal renders one consistent truth; no section re-queries differently.
- Loaders run server-side with the user-scoped Supabase client, so RLS applies automatically.

## Role-based shell & navigation
- `dashboard/layout.tsx` reads the caller's role(s) and renders the matching **Shell** (sidebar + top bar). `dashboard/page.tsx` redirects to that role's home.
- Each role has a `NavItem[]`; `PortalNav` highlights the active route, `MobileNav` gives the same nav on phones.
- Sections are routes (`dashboard/<role>/<section>/page.tsx`) — one source of truth per section, deep-linkable.

## Empty, loading, and error states
- **Empty**: every list/queue has a designed empty state that tells the role what to do next ("No appointments today — nothing to prep"), not a blank panel.
- **Loading**: server components stream; forms use `SubmitButton` (`useFormStatus`) so every action shows a pending state and disables to prevent double-submit.
- **Error**: server actions return typed errors surfaced inline with a plain-language cause + fix; never a silent failure or a raw stack.

## One source of truth per role
- A given fact is loaded and rendered from **one place** per portal. "Today's appointments" comes from the receptionist loader, not re-fetched three ways across three widgets.
- Derived values (stage label, outstanding balance) live in the loader's `derive()`, so every screen agrees.

## Mobile responsiveness
- Assume the client and receptionist are often on a phone or tablet (front desk iPad, client on mobile).
- Sidebar collapses to `MobileNav`; tables scroll inside their own `overflow-x-auto` container so the page never scrolls sideways.
- File upload uses native `<label>`-wrapped inputs (iOS Safari blocks programmatic clicks on hidden inputs — see `../references/gotchas.md`).
- Touch targets ≥ 44px; primary actions reachable without horizontal scroll. Test the day view and check-in on a real tablet width.
