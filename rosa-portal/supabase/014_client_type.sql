-- ============================================================================
-- 014_client_type.sql — individual vs business clients, and the link between a
-- business and its owner.
--
-- Rosa serves both individuals and businesses, and a business owner has two
-- records: their personal one and the business. `client_type` drives the badge;
-- `owner_client_id` (set on the BUSINESS row) points to the owner's personal
-- client row, so the two profiles connect — from a person you can list their
-- businesses, from a business you can see its owner. Staff manage clients
-- (RLS: clients_staff), so no policy changes are needed.
-- ============================================================================

alter table public.clients add column if not exists client_type text not null default 'individual'
  check (client_type in ('individual', 'business'));

alter table public.clients add column if not exists owner_client_id uuid
  references public.clients(id) on delete set null;

create index if not exists clients_owner_idx on public.clients(owner_client_id);
