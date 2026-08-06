-- ============================================================================
-- 017_invite_to_portal.sql — invitation-based portal access.
--
-- The portal is for known clients, not the public. So we stop auto-creating a
-- client for every signup. Instead a staff-created client record IS the invite:
-- when someone signs up with an email that matches an existing UNLINKED client
-- record in Rosa's org, their login attaches to that record. Unknown emails get
-- NO enrollment — they can create an auth account but see nothing until staff
-- add a record for them. Staff allowlist behavior is unchanged.
-- ============================================================================

create or replace function public.enroll_into_rosa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rosa_org uuid := 'a0000000-0000-4000-8000-000000000001';
  as_staff boolean;
  existing_client uuid;
begin
  select exists (
    select 1 from public.staff_emails s
    where s.org_id = rosa_org and lower(s.email) = lower(new.email)
  ) into as_staff;

  if as_staff then
    insert into public.memberships (org_id, user_id, role, status)
      values (rosa_org, new.id, 'staff', 'active')
      on conflict (org_id, user_id) do nothing;
    return new;
  end if;

  -- Invite-by-email: attach this login to a staff-created client record that has
  -- this email and no login yet. First match by created order.
  select id into existing_client
    from public.clients
    where org_id = rosa_org and profile_id is null and lower(email) = lower(new.email)
    order by created_at asc
    limit 1;

  if existing_client is not null then
    update public.clients set profile_id = new.id where id = existing_client;
    insert into public.memberships (org_id, user_id, role, status)
      values (rosa_org, new.id, 'client', 'active')
      on conflict (org_id, user_id) do nothing;
  end if;
  -- else: unknown email → no enrollment (invite-only).

  return new;
end;
$$;
