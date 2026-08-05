-- ============================================================================
-- 009_route_request.sql — routing as a database function (not a service-role
-- client). new -> routed is a SYSTEM step, but a client cannot update `requests`
-- under RLS. Rather than reach for the service role in app code, expose a narrow
-- SECURITY DEFINER function that authorizes the caller in-SQL, bumps the status,
-- and writes the audit event atomically. Trust stays in the database layer.
--
-- Authorization is enforced INSIDE the function (definer bypasses RLS): the
-- caller must be the request's own client, or staff in the request's org.
-- Idempotent — only routes from 'new'; a second call is a no-op.
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
end;
$$;

-- Only signed-in users may call it; the function itself decides if THEY may route
-- THIS request. anon gets nothing.
revoke all on function public.route_request(uuid) from public;
grant execute on function public.route_request(uuid) to authenticated;
