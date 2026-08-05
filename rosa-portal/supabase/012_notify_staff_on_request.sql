-- ============================================================================
-- 012_notify_staff_on_request.sql — staff get a notification when a client
-- submits a request.
--
-- A request is created in the CLIENT's session, and a client cannot insert a
-- notification addressed to staff under RLS. Routing already happens in the
-- SECURITY DEFINER function route_request (009), which runs with elevated
-- rights — so that's the natural, safe place to also fan a notification out to
-- every active staff/admin member of the org. This re-defines route_request:
-- identical behavior, plus the staff notification, emitted only on the actual
-- new -> routed step (so it fires exactly once per request).
-- ============================================================================

create or replace function public.route_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r           public.requests;
  target_role text;
begin
  select * into r from public.requests where id = p_request_id;
  if not found then
    raise exception 'route_request: request % not found', p_request_id;
  end if;

  -- Authorize: the request's own client, or staff in its org. Nobody else.
  if not (r.client_id = public.my_client_id(r.org_id) or public.is_staff(r.org_id)) then
    raise exception 'route_request: not authorized' using errcode = '42501';
  end if;

  -- Idempotent: only route out of 'new'.
  if r.status <> 'new' then
    return;
  end if;

  select default_role into target_role
    from public.request_categories where key = r.category_key;
  target_role := coalesce(target_role, 'staff');

  update public.requests
     set status = 'routed', assigned_role = target_role
   where id = p_request_id and status = 'new';

  insert into public.activity_events
    (org_id, actor_id, entity_type, entity_id, verb, from_status, to_status, metadata)
  values
    (r.org_id, auth.uid(), 'request', p_request_id, 'routed', 'new', 'routed',
     jsonb_build_object('role', target_role));

  -- NEW: notify every active staff/admin of the org that a request came in.
  insert into public.notifications
    (org_id, recipient_id, type, title, link, entity_type, entity_id, channel, status)
  select
    r.org_id,
    m.user_id,
    'request_created',
    'New client request',
    '/dashboard/staff/requests/' || p_request_id::text,
    'request',
    p_request_id,
    'in_app',
    'sent'
  from public.memberships m
  where m.org_id = r.org_id
    and m.status = 'active'
    and m.role in ('staff', 'admin');
end;
$$;

revoke all on function public.route_request(uuid) from public;
grant execute on function public.route_request(uuid) to authenticated;
