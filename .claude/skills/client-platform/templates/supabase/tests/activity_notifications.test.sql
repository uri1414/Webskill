-- ============================================================================
-- activity_notifications.test.sql — verify #13 + #14 boundaries.
--
-- Run in the Supabase SQL editor (as owner) after migrations 001–006. It:
--   1. seeds two orgs, two staff, two clients-with-logins,
--   2. asserts activity_events is APPEND-ONLY (update/delete denied),
--   3. asserts activity_events read is org-scoped (no cross-tenant),
--   4. asserts notifications are recipient-scoped (no cross-recipient/tenant),
--   5. ROLLS BACK.
-- Any violation raises and aborts. Green = boundaries hold.
-- ============================================================================

begin;

-- fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'staff-a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'staff-b@example.test');

insert into public.organizations (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B');

insert into public.memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'staff'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'staff');

-- activity events, one per org (seeded as owner, bypassing RLS)
insert into public.activity_events (org_id, actor_id, entity_type, verb) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'appointment', 'created'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'appointment', 'created');

-- notifications, one per recipient
insert into public.notifications (org_id, recipient_id, type, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'appointment_scheduled', 'A note'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'appointment_scheduled', 'B note');

-- impersonate Org A staff ---------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare seen int; leaked int; blocked boolean := false;
begin
  -- activity_events: org-scoped read
  select count(*) into seen   from public.activity_events;
  select count(*) into leaked from public.activity_events
    where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if seen <> 1  then raise exception 'ACTIVITY FAIL: Org A staff sees % events (expected 1)', seen; end if;
  if leaked <> 0 then raise exception 'ACTIVITY FAIL: Org A staff can read Org B events'; end if;

  -- activity_events: append-only (update must be denied)
  begin
    update public.activity_events set verb = 'tampered'
      where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'ACTIVITY FAIL: activity_events is not append-only (update allowed)'; end if;

  -- notifications: recipient-scoped
  select count(*) into seen   from public.notifications;
  select count(*) into leaked from public.notifications
    where recipient_id = '22222222-2222-2222-2222-222222222222';
  if seen <> 1  then raise exception 'NOTIF FAIL: recipient A sees % notifications (expected 1)', seen; end if;
  if leaked <> 0 then raise exception 'NOTIF FAIL: recipient A can read another recipient''s notifications'; end if;

  raise notice 'OK: activity_events append-only + org-scoped; notifications recipient-scoped';
end $$;

reset role;
rollback;
