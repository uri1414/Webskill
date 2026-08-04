-- ============================================================================
-- 007_status_services_payments.sql — schema completion (#15)
--
-- (1) Status CHECK constraints on appointments & engagements — the DB now
--     rejects invalid states (previously bare `text`).
-- (2) services + payments core tables (org-scoped). payments is also what makes
--     the payment-ordering fix in #18 concrete: an obligation (status='pending')
--     exists before the paid/waived confirmation guard.
--
-- Decision on the "minimum payments/services/staff_members" question:
--   * services  -> ADD (the fee/deposit source).
--   * payments  -> ADD (obligations + record of pay; required by #18).
--   * staff_members -> SKIP. Staff are `profiles` with a staff/admin `membership`;
--     a separate table would duplicate that. Put a job title on the membership
--     if/when a display label is needed.
-- ============================================================================

-- (1) status constraints -----------------------------------------------------
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('requested','scheduled','confirmed','checked_in','completed','cancelled','no_show'));

-- engagements default was 'open' (not a documented state) — align it to the
-- documented lifecycle before constraining, or the default would violate CHECK.
alter table public.engagements alter column status set default 'intake';
alter table public.engagements drop constraint if exists engagements_status_check;
alter table public.engagements add constraint engagements_status_check
  check (status in ('intake','waiting_for_documents','ready_for_preparation',
                    'in_preparation','ready_for_review','awaiting_client','completed','closed'));

-- (2a) services --------------------------------------------------------------
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  description      text,
  category         text,
  duration_minutes int  not null default 60,
  price            numeric(10,2),
  deposit_amount   numeric(10,2),
  requires_deposit boolean not null default false,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists services_org_idx on public.services(org_id);
create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();

-- (2b) payments --------------------------------------------------------------
create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  engagement_id  uuid references public.engagements(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  service_id     uuid references public.services(id) on delete set null,
  type           text not null default 'service_fee'
                   check (type in ('deposit','service_fee','invoice','retainer','consult_fee')),
  status         text not null default 'pending'
                   check (status in ('pending','paid','failed','refunded','void')),
  method         text check (method in ('card','cash','check','ach','other')),
  amount         numeric(10,2) not null,
  memo           text,
  due_date       date,
  paid_at        timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists payments_org_idx    on public.payments(org_id);
create index if not exists payments_client_idx  on public.payments(client_id);
create index if not exists payments_status_idx on public.payments(status);
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- RLS ------------------------------------------------------------------------
alter table public.services enable row level security;
alter table public.payments enable row level security;

-- services: any member reads the menu; staff manage.
create policy services_read  on public.services for select using (public.is_member(org_id));
create policy services_staff on public.services for all
  using (public.is_staff(org_id)) with check (public.is_staff(org_id));

-- payments: staff full; a client reads their own.
create policy payments_staff    on public.payments for all
  using (public.is_staff(org_id)) with check (public.is_staff(org_id));
create policy payments_own_read on public.payments for select
  using (client_id = public.my_client_id(org_id));
