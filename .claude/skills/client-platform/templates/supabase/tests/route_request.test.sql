-- ============================================================================
-- route_request.test.sql — PROVE the routing function's authorization + effect.
--
-- Run after migrations 001-003, 008, 009. Seeds one org with a staff user and
-- two clients, each owning a 'new' request, then asserts (as each role):
--   client CAN route their OWN request         → status routed + "routed" event
--   routing is IDEMPOTENT                        → second call no-op, no error
--   client CANNOT route ANOTHER client's request → 42501 (caught)
--   staff CAN route a request in their org       → status routed
-- Then ROLLS BACK.
-- ============================================================================

begin;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staff-a@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'client-a@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'client-a2@example.test');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'staff'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'client'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'client');

insert into public.clients (id, org_id, profile_id, first_name) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Client A'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Client A2');

-- a 'new' request per client
insert into public.requests (id, org_id, client_id, category_key, subject, status) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'appointment', 'A req', 'new'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee44',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'appointment', 'A2 req', 'new');

-- 1) CLIENT A routes their OWN request -----------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

do $$
declare st text; ev int;
begin
  perform public.route_request('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33');
  select status into st from public.requests where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33';
  if st <> 'routed' then raise exception 'ROUTE FAIL: own request status % (expected routed)', st; end if;
  select count(*) into ev from public.activity_events
    where entity_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33' and verb = 'routed';
  if ev <> 1 then raise exception 'ROUTE FAIL: expected 1 routed event, got %', ev; end if;
  raise notice 'OK: client routed own request (new -> routed) + event written';
end $$;

-- 2) idempotent: a second call is a no-op, no error ----------------------------
do $$
declare ev int;
begin
  perform public.route_request('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33');
  select count(*) into ev from public.activity_events
    where entity_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee33' and verb = 'routed';
  if ev <> 1 then raise exception 'ROUTE FAIL: idempotency broken, % routed events', ev; end if;
  raise notice 'OK: routing is idempotent (still 1 routed event)';
end $$;

-- 3) CLIENT A CANNOT route CLIENT A2's request -> 42501 ------------------------
do $$
begin
  perform public.route_request('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee44');
  raise exception 'ROUTE FAIL: client routed another client''s request';
exception when insufficient_privilege then
  raise notice 'OK: client denied routing another client''s request';
end $$;

-- 4) STAFF can route a request in their org ------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare st text;
begin
  perform public.route_request('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee44');
  select status into st from public.requests where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee44';
  if st <> 'routed' then raise exception 'ROUTE FAIL: staff route left status % (expected routed)', st; end if;
  raise notice 'OK: staff routed a request in their org';
end $$;

reset role;
rollback;
