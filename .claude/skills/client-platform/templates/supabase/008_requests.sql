-- ============================================================================
-- 008_requests.sql — Request Engine (Rosa Appointment Request slice).
--
-- The Request Engine is the practice's front door: a client "request for work"
-- is intook, categorized, routed, claimed, and resolved here. It ORCHESTRATES
-- the core spine (appointments/engagements/tasks) — it never owns the
-- professional work. See docs/adr/0001-request-engine.md.
--
-- v1 scope: portal-submitted requests, seeded categories, role routing + staff
-- claim, and exactly ONE conversion path — Appointment Request -> Appointment.
-- Org-scoped + RLS from day one, like every foundation table. The request
-- lifecycle runs through templates/lib/requests.ts (the Workflow-Engine
-- transition pattern); this file is the data layer + its RLS backstop.
-- ============================================================================

-- request_categories: a GLOBAL seeded lookup (deliberately NOT org-scoped) —
-- reference data, like an enum. Seeded here; no tenant-facing editor in v1
-- (ADR-0001). Any authenticated user may read it; the app never writes it.
create table if not exists public.request_categories (
  key          text primary key,
  label        text not null,
  default_role text not null default 'staff' check (default_role in ('admin','staff')),
  sort_order   int  not null default 0
);

insert into public.request_categories (key, label, default_role, sort_order) values
  ('appointment', 'Appointment request', 'staff', 10),
  ('document',    'Document question',   'staff', 20),
  ('billing',     'Billing question',    'staff', 30),
  ('general',     'General question',    'staff', 40)
on conflict (key) do nothing;

-- requests: the mutable request record. Portal-originated content is STORED
-- (it IS the request). Lifecycle is staff-managed; the client only creates.
create table if not exists public.requests (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  category_key     text not null references public.request_categories(key),
  subject          text,
  body             text,
  status           text not null default 'new'
                   check (status in ('new','routed','in_progress','waiting_on_client',
                                     'resolved','closed','no_action','spam')),
  priority         text not null default 'normal'
                   check (priority in ('low','normal','high','urgent')),
  assigned_role    text check (assigned_role in ('admin','staff')),
  assigned_user_id uuid references public.profiles(id) on delete set null,
  resolution       text check (resolution in ('answered','converted','duplicate','no_action','spam')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists requests_org_idx    on public.requests(org_id);
create index if not exists requests_client_idx on public.requests(client_id);
create index if not exists requests_status_idx on public.requests(org_id, status);
create trigger requests_touch before update on public.requests
  for each row execute function public.touch_updated_at();

-- request_messages: correspondence on a request. Portal-stored; provider fields
-- are nullable in v1 (outbound is Baseline-managed). DISTINCT from
-- activity_events (immutable audit) — message CONTENT never folds into the audit.
create table if not exists public.request_messages (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  request_id          uuid not null references public.requests(id) on delete cascade,
  direction           text not null check (direction in ('inbound','outbound')),
  author_id           uuid references public.profiles(id) on delete set null,
  body                text,
  provider            text,
  provider_message_id text,
  delivery_status     text not null default 'stored'
                      check (delivery_status in ('stored','sent','delivered','failed')),
  created_at          timestamptz not null default now()
);
create index if not exists request_messages_request_idx on public.request_messages(request_id, created_at);

-- request_relations: links a request to the entity it produced. v1 uses it for
-- the Appointment conversion; ready for engagement/task later with NO new
-- columns. The unique key makes conversion idempotent (one link per entity).
create table if not exists public.request_relations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  request_id  uuid not null references public.requests(id) on delete cascade,
  entity_type text not null check (entity_type in ('appointment','engagement','task')),
  entity_id   uuid not null,
  relation    text not null default 'converted_to',
  created_at  timestamptz not null default now(),
  unique (request_id, entity_type, entity_id)
);
create index if not exists request_relations_request_idx on public.request_relations(request_id);
create index if not exists request_relations_entity_idx  on public.request_relations(entity_type, entity_id);

-- ---- RLS -------------------------------------------------------------------
alter table public.request_categories enable row level security;
alter table public.requests           enable row level security;
alter table public.request_messages   enable row level security;
alter table public.request_relations  enable row level security;

-- categories: any authenticated caller reads the lookup; seeded, never written
-- from the app (no insert/update/delete policy -> RLS denies writes).
create policy request_categories_read on public.request_categories for select
  using (true);

-- requests: staff full; a client reads and creates ONLY their own, and only in
-- the 'new' state. The client cannot advance the lifecycle (no update policy).
create policy requests_staff on public.requests for all
  using (public.is_staff(org_id)) with check (public.is_staff(org_id));
create policy requests_own_read on public.requests for select
  using (client_id = public.my_client_id(org_id));
create policy requests_own_insert on public.requests for insert
  with check (client_id = public.my_client_id(org_id) and status = 'new');

-- request_messages: staff full; a client reads messages on their own requests
-- and may post an INBOUND message (as themselves) to their own request.
create policy request_messages_staff on public.request_messages for all
  using (public.is_staff(org_id)) with check (public.is_staff(org_id));
create policy request_messages_own_read on public.request_messages for select
  using (exists (
    select 1 from public.requests r
    where r.id = request_messages.request_id
      and r.client_id = public.my_client_id(request_messages.org_id)));
create policy request_messages_own_insert on public.request_messages for insert
  with check (
    direction = 'inbound'
    and author_id = auth.uid()
    and exists (
      select 1 from public.requests r
      where r.id = request_messages.request_id
        and r.client_id = public.my_client_id(request_messages.org_id)));

-- request_relations: staff full; a client may READ the relations on their own
-- request (to see the appointment it became). No client writes.
create policy request_relations_staff on public.request_relations for all
  using (public.is_staff(org_id)) with check (public.is_staff(org_id));
create policy request_relations_own_read on public.request_relations for select
  using (exists (
    select 1 from public.requests r
    where r.id = request_relations.request_id
      and r.client_id = public.my_client_id(request_relations.org_id)));

-- Grants: requests/messages/relations inherit CRUD for `authenticated` from the
-- default privileges set in 003_grants.sql; RLS above is the gate. (request_categories
-- likewise has the grant but no write policy, so it stays effectively read-only.)
