-- ============================================================================
-- 011_request_service_fields.sql — MVP intake improvement (approved brief).
--
-- Adds a "what do you need help with?" service to each request plus a timing
-- preference, WITHOUT new engines. The service reuses the existing category
-- mechanism (each service is a request_categories row); preference fields are
-- two nullable columns on `requests`. RLS, capabilities, lifecycle, and the
-- routing function are unchanged — this is additive only (no data loss).
-- ============================================================================

-- Timing preference (a preference, NOT a confirmed appointment).
alter table public.requests add column if not exists preferred_date date;
alter table public.requests add column if not exists preferred_time text;

-- Seed the service catalog (all route to staff, same as before). Existing
-- categories are left in place; these are additive.
insert into public.request_categories (key, label, default_role, sort_order) values
  ('tax_prep',     'Tax preparation',                 'staff', 10),
  ('tax_question', 'Tax question',                    'staff', 20),
  ('business_tax', 'Business tax help',               'staff', 30),
  ('bookkeeping',  'Bookkeeping',                     'staff', 40),
  ('doc_dropoff',  'Document drop-off',               'staff', 50),
  ('followup',     'Existing appointment follow-up',  'staff', 60),
  ('other',        'Other',                           'staff', 70)
on conflict (key) do nothing;
