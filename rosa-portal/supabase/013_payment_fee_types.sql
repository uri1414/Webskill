-- ============================================================================
-- 013_payment_fee_types.sql — add cancellation & no-show fee types.
--
-- Rosa's appointments are mostly paid, and she also charges for late
-- cancellations and no-shows. The payments table already exists (007) with
-- staff-manage / client-read RLS; it just needs two more values in the `type`
-- CHECK so those fees are first-class (and reportable) rather than lumped into
-- a generic 'service_fee'.
-- ============================================================================

alter table public.payments drop constraint if exists payments_type_check;
alter table public.payments add constraint payments_type_check
  check (type in (
    'deposit', 'service_fee', 'invoice', 'retainer', 'consult_fee',
    'cancellation_fee', 'no_show_fee'
  ));
