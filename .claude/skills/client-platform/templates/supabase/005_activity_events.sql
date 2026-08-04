-- ============================================================================
-- 005_activity_events.sql — append-only audit log (#13)
--
-- Every meaningful action (state change, override, assignment, conversion)
-- appends one row here. It is org-scoped and soft-references any entity, so any
-- table can emit an event without a hard FK. APPEND-ONLY: there is no update or
-- delete policy, AND update/delete is revoked from authenticated, so history
-- cannot be rewritten. See references/foundation.md and docs/adr/0001.
-- ============================================================================

create table if not exists public.activity_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null, -- null = system/automation
  entity_type text not null,          -- 'appointment' | 'engagement' | 'payment' | 'request' | ...
  entity_id   uuid,
  verb        text not null,          -- 'created' | 'status_changed' | 'assigned' | 'converted' | ...
  from_status text,
  to_status   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_events_org_idx    on public.activity_events(org_id);
create index if not exists activity_events_entity_idx on public.activity_events(entity_type, entity_id);
create index if not exists activity_events_created_idx on public.activity_events(org_id, created_at desc);

alter table public.activity_events enable row level security;

-- Read: staff see the whole org's history; a non-staff sees events they caused.
-- (Client-facing timelines that show events about a client's own engagements are
-- broadened per-feature; the foundation stays tight.)
create policy activity_events_read on public.activity_events for select
  using (public.is_staff(org_id) or actor_id = auth.uid());

-- Write: a member may append within their org, as themselves; staff may append
-- any actor (e.g. recording on someone's behalf). System/automation writes go
-- through the service-role client and bypass RLS.
create policy activity_events_insert on public.activity_events for insert
  with check (public.is_member(org_id) and (public.is_staff(org_id) or actor_id = auth.uid()));

-- APPEND-ONLY: no update/delete policy (RLS denies), and revoke the privilege
-- outright so it can't be re-granted by accident.
revoke update, delete on public.activity_events from authenticated;
