-- ============================================================================
-- 006_notifications.sql — recipient-scoped notifications (#14)
--
-- One row per recipient per event. The row is the durable log; delivery to a
-- channel (in-app / email / sms) goes through the adapter seam in
-- templates/lib/notifications.ts so the engine never depends on one vendor.
-- In-app v1 = the row itself; email/sms adapters are added later without
-- touching callers. Org-scoped + recipient-scoped by RLS.
-- ============================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type         text not null,        -- 'appointment_scheduled' | 'payment_due' | ...
  title        text not null,
  body         text,                 -- keep sensitive detail OUT; link into the portal
  link         text,
  entity_type  text,
  entity_id    uuid,
  channel      text not null default 'in_app' check (channel in ('in_app','email','sms')),
  status       text not null default 'pending' check (status in ('pending','sent','failed','read')),
  read_at      timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, read_at);
create index if not exists notifications_org_idx       on public.notifications(org_id);

alter table public.notifications enable row level security;

-- Recipient: read and update (mark read) only their own.
create policy notifications_own_read on public.notifications for select
  using (recipient_id = auth.uid());
create policy notifications_own_update on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Staff (and system via service-role) create/manage within their org.
create policy notifications_staff on public.notifications for all
  using (public.is_staff(org_id)) with check (public.is_staff(org_id));
