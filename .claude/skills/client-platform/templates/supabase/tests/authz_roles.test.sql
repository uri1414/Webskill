-- ============================================================================
-- authz_roles.test.sql — PROVE the role matrix is enforced at the DATABASE.
--
-- rls_isolation.test.sql proves org A can't see org B. This test proves the
-- OTHER half: within one org, a `client` cannot do what only `staff` may. It is
-- the RLS mirror of lib/authz.ts — if the capability matrix says clients can
-- read appointments but not write them, the database must agree.
--
-- Run after migrations 001–003 (as the project owner). It:
--   1. seeds one org with a staff user, a client user, a client row, and one
--      appointment (inside a tx),
--   2. impersonates the CLIENT and asserts: reads own appointment (allowed),
--      but INSERT appointment / INSERT task / UPDATE appointment are all denied,
--   3. impersonates STAFF and asserts writes succeed,
--   4. ROLLS BACK.
--
-- Two denial shapes, both checked:
--   * INSERT under a WITH CHECK it fails  -> raises 42501 (caught below).
--   * UPDATE with no matching policy row  -> silently affects 0 rows (no error);
--     asserted via GET DIAGNOSTICS row_count, NOT an exception handler.
-- ============================================================================

begin;

-- 1) fixtures ---------------------------------------------------------------
-- Inserting into auth.users fires handle_new_user(), creating profiles rows.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staff-a@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'client-a@example.test');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'client');

-- The client user's own client record (profile_id links login -> client row).
insert into public.clients (id, org_id, profile_id, first_name) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '33333333-3333-3333-3333-333333333333', 'Client A');

insert into public.appointments (id, org_id, client_id, title) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'Intake');

-- 2) impersonate the CLIENT --------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- 2a) client CAN read their own appointment
do $$
declare seen int;
begin
  select count(*) into seen from public.appointments
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  if seen <> 1 then raise exception 'AUTHZ FAIL: client cannot read own appointment (saw %)', seen; end if;
  raise notice 'OK: client reads own appointment';
end $$;

-- 2b) client CANNOT insert an appointment (write is staff-only) -> 42501
do $$
begin
  insert into public.appointments (org_id, client_id, title) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'Sneaky');
  raise exception 'AUTHZ FAIL: client was allowed to INSERT an appointment';
exception
  when insufficient_privilege then
    raise notice 'OK: client denied INSERT appointment';
end $$;

-- 2c) client CANNOT insert a task (tasks are staff-only, no client policy) -> 42501
do $$
begin
  insert into public.tasks (org_id, title) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sneaky task');
  raise exception 'AUTHZ FAIL: client was allowed to INSERT a task';
exception
  when insufficient_privilege then
    raise notice 'OK: client denied INSERT task';
end $$;

-- 2d) client CANNOT update an appointment. No UPDATE policy applies to the
--     client, so the row is invisible to UPDATE and 0 rows change — silently,
--     with NO error. Assert on row_count, not on an exception.
do $$
declare n int;
begin
  update public.appointments set title = 'Hijacked'
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'AUTHZ FAIL: client UPDATE affected % row(s)', n; end if;
  raise notice 'OK: client UPDATE affected 0 rows (denied)';
end $$;

-- 3) impersonate STAFF -------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 3a) staff CAN insert an appointment
do $$
begin
  insert into public.appointments (org_id, client_id, title) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'Staff-created');
  raise notice 'OK: staff INSERT appointment allowed';
end $$;

-- 3b) staff sees the org's appointments (the seed + the one just inserted)
do $$
declare seen int;
begin
  select count(*) into seen from public.appointments
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if seen < 2 then raise exception 'AUTHZ FAIL: staff sees % org appointments (expected >= 2)', seen; end if;
  raise notice 'OK: staff sees org appointments (%).', seen;
end $$;

reset role;
rollback;  -- nothing persists; the point was the assertions above
