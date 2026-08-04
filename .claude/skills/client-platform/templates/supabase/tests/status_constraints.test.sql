-- ============================================================================
-- status_constraints.test.sql — verify #15: the DB rejects invalid states.
--
-- Run in the Supabase SQL editor after 001–007. Runs as owner (CHECK applies to
-- every role, so no impersonation needed). Rolls back.
-- ============================================================================

begin;

insert into public.organizations (id, name)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A');
insert into public.clients (id, org_id, first_name)
  values ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'C');

do $$
declare blocked boolean;
begin
  -- appointments rejects an invalid status
  blocked := false;
  begin
    insert into public.appointments (org_id, client_id, status)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'not_a_status');
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'STATUS FAIL: appointments accepted an invalid status'; end if;

  -- engagements rejects an invalid status
  blocked := false;
  begin
    insert into public.engagements (org_id, client_id, status)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'not_a_status');
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'STATUS FAIL: engagements accepted an invalid status'; end if;

  -- a valid status is accepted
  insert into public.appointments (org_id, client_id, status)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'requested');

  raise notice 'OK: appointments & engagements reject invalid status; valid status accepted';
end $$;

rollback;
