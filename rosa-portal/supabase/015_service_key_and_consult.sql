-- ============================================================================
-- 015_service_key_and_consult.sql
--
-- (1) Record WHICH service an appointment is for, so the client can be shown the
--     right "what to bring" list. Set at confirm time from the request category.
-- (2) Add a "Business consultation" service — the in-person meeting a client must
--     book before Rosa creates a business profile for them (whether they already
--     have a business or want to start one).
-- ============================================================================

alter table public.appointments add column if not exists service_key text;

insert into public.request_categories (key, label, default_role, sort_order) values
  ('business_consult', 'Business consultation', 'staff', 35)
on conflict (key) do nothing;
