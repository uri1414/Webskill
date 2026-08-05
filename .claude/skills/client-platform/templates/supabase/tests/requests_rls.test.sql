-- ============================================================================
-- requests_rls.test.sql — PROVE the Request Engine's security + conversion path.
--
-- Run after migrations 001-003 and 008 (as the project owner). It seeds two
-- orgs and, in org A, a staff user + two separate clients, then asserts:
--   CLIENT can:    read the category lookup; create their OWN request; read it.
--   CLIENT cannot: create a request for ANOTHER client; create one already past
--                  'new'; read another client's request (same org); UPDATE their
--                  own request (lifecycle is staff-only).
--   CROSS-TENANT:  org B staff cannot see org A requests.
--   STAFF can:     see the org's requests; claim one; run the Appointment
--                  conversion (create appointment + link relation + resolve).
--   CLIENT then sees the resulting appointment link on their own request.
-- Then ROLLS BACK. Two denial shapes are used deliberately: INSERT under a
-- failed WITH CHECK raises 42501 (caught); UPDATE with no matching policy is a
-- silent 0-row no-op (checked via GET DIAGNOSTICS).
-- ============================================================================

begin;

-- 1) fixtures ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staff-a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'staff-b@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'client-a@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'client-a2@example.test');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'client'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'client');

-- two separate clients in org A, each linked to their own login
insert into public.clients (id, org_id, profile_id, first_name) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Client A'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Client A2');

-- a request owned by client A2 (used to prove client A cannot read it)
insert into public.requests (id, org_id, client_id, category_key, subject, status) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'appointment', 'A2 request', 'new');

-- a request in org B (used to prove cross-tenant isolation)
insert into public.clients (id, org_id, first_name) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccb1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Client B');
insert into public.requests (id, org_id, client_id, category_key, subject) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeb1',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'cccccccc-cccc-cccc-cccc-ccccccccccb1', 'appointment', 'B request');

-- 2) impersonate CLIENT A ----------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- 2a) client can read the seeded category lookup
do $$
declare n int;
begin
  select count(*) into n from public.request_categories;
  if n < 1 then raise exception 'REQ FAIL: client cannot read request_categories'; end if;
  raise notice 'OK: client reads category lookup (% rows)', n;
end $$;

-- 2b) client CAN create their OWN request (status new)
do $$
begin
  insert into public.requests (id, org_id, client_id, category_key, subject) values
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'appointment', 'Need a tax appointment');
  raise notice 'OK: client created own request';
end $$;

-- 2c) client CANNOT create a request for ANOTHER client -> 42501
do $$
begin
  insert into public.requests (org_id, client_id, category_key, subject) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'appointment', 'Impersonation');
  raise exception 'REQ FAIL: client created a request for another client';
exception when insufficient_privilege then
  raise notice 'OK: client denied request for another client';
end $$;

-- 2d) client CANNOT create a request already past 'new' -> 42501
do $$
begin
  insert into public.requests (org_id, client_id, category_key, status) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'appointment', 'resolved');
  raise exception 'REQ FAIL: client created a request past the new state';
exception when insufficient_privilege then
  raise notice 'OK: client denied non-new request';
end $$;

-- 2e) client sees ONLY their own request, not client A2's
do $$
declare mine int; others int;
begin
  select count(*) into mine   from public.requests
    where client_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc3';
  select count(*) into others from public.requests
    where client_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc4';
  if mine <> 1 then raise exception 'REQ FAIL: client sees % own requests (expected 1)', mine; end if;
  if others <> 0 then raise exception 'REQ FAIL: client can read another client''s request'; end if;
  raise notice 'OK: client sees only their own request';
end $$;

-- 2f) client CANNOT update their own request (lifecycle is staff-only) -> 0 rows
do $$
declare n int;
begin
  update public.requests set status = 'resolved'
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'REQ FAIL: client UPDATE affected % row(s)', n; end if;
  raise notice 'OK: client UPDATE affected 0 rows (denied)';
end $$;

-- 3) cross-tenant: org B staff cannot see org A requests --------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare leaked int;
begin
  select count(*) into leaked from public.requests
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if leaked <> 0 then raise exception 'REQ FAIL: org B staff can read % org A requests', leaked; end if;
  raise notice 'OK: org B staff sees no org A requests';
end $$;

-- 4) STAFF A: claim + run the Appointment conversion ------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 4a) staff sees the org's requests (A's own + A2's = 2)
do $$
declare n int;
begin
  select count(*) into n from public.requests
    where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if n < 2 then raise exception 'REQ FAIL: staff sees % org requests (expected >= 2)', n; end if;
  raise notice 'OK: staff sees org requests (%).', n;
end $$;

-- 4b) staff claims the client's request, then converts it: create the
--     appointment, link the relation, resolve the request. All must succeed.
do $$
declare appt uuid;
begin
  update public.requests
    set status = 'in_progress', assigned_user_id = '11111111-1111-1111-1111-111111111111'
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33';

  insert into public.appointments (org_id, client_id, title, status) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'Tax appointment', 'requested')
    returning id into appt;

  insert into public.request_relations (org_id, request_id, entity_type, entity_id) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33', 'appointment', appt);

  update public.requests
    set status = 'resolved', resolution = 'converted'
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33';

  raise notice 'OK: staff claimed + converted request to appointment %', appt;
end $$;

-- 5) CLIENT A sees the appointment link on their own request ----------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int; st text;
begin
  select count(*) into n from public.request_relations
    where request_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33' and entity_type = 'appointment';
  if n <> 1 then raise exception 'REQ FAIL: client sees % appointment links (expected 1)', n; end if;
  select status into st from public.requests
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33';
  if st <> 'resolved' then raise exception 'REQ FAIL: client sees request status % (expected resolved)', st; end if;
  raise notice 'OK: client sees converted appointment link + resolved status';
end $$;

reset role;
rollback;  -- nothing persists; the point was the assertions above
