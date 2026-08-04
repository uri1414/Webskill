-- ============================================================================
-- rls_isolation.test.sql — PROVE tenant isolation before building features.
--
-- Run in the Supabase SQL editor (as the project owner) after migrations
-- 001–003 are applied. It:
--   1. asserts RLS is enabled on every business table,
--   2. seeds two orgs, two users, and one appointment each (inside a tx),
--   3. impersonates each org's user via request.jwt.claims + the authenticated
--      role, and asserts NO cross-tenant row is ever visible,
--   4. ROLLS BACK, so nothing persists.
-- Any leak raises an exception and aborts. Green = isolation holds.
--
-- Note: inserting into auth.users fires handle_new_user(), which creates the
-- matching profiles rows automatically.
-- ============================================================================

begin;

-- 1) structural: RLS must be ON everywhere ----------------------------------
do $$
declare t text; on_flag boolean;
begin
  foreach t in array array[
    'organizations','profiles','memberships','clients',
    'engagements','appointments','documents','tasks'
  ] loop
    select relrowsecurity into on_flag
      from pg_class where relname = t and relnamespace = 'public'::regnamespace;
    if on_flag is not true then
      raise exception 'RLS NOT ENABLED on public.%', t;
    end if;
  end loop;
  raise notice 'OK: RLS enabled on all business tables';
end $$;

-- 2) fixtures ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staff-a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'staff-b@example.test');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'staff');

insert into public.clients (id, org_id, first_name) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Client A'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Client B');

insert into public.appointments (org_id, client_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'A appt'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'B appt');

-- 3a) impersonate Org A staff ----------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare seen int; leaked int;
begin
  select count(*) into seen   from public.appointments;
  select count(*) into leaked from public.appointments
    where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if seen <> 1 then raise exception 'ISOLATION FAIL: Org A staff sees % appointments (expected 1)', seen; end if;
  if leaked <> 0 then raise exception 'ISOLATION FAIL: Org A staff can read Org B rows'; end if;
  raise notice 'OK: Org A staff sees only Org A';
end $$;

-- 3b) impersonate Org B staff ----------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
declare seen int; leaked int;
begin
  select count(*) into seen   from public.appointments;
  select count(*) into leaked from public.appointments
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if seen <> 1 then raise exception 'ISOLATION FAIL: Org B staff sees % appointments (expected 1)', seen; end if;
  if leaked <> 0 then raise exception 'ISOLATION FAIL: Org B staff can read Org A rows'; end if;
  raise notice 'OK: Org B staff sees only Org B';
end $$;

reset role;
rollback;  -- nothing persists; the point was the assertions above
