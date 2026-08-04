-- ============================================================================
-- 002_rls.sql — org-scoped row-level security (the safety backstop)
--
-- Every policy constrains rows to an org the caller is an active member of, via
-- the helpers in 001_schema.sql. RLS is the BACKSTOP; the application layer
-- (lib/authz.ts) is the primary gate. Both must agree — see references/foundation.md.
--
-- A table with RLS enabled and no policy denies all access. That is the safe
-- default: add a policy deliberately, never a blanket one.
-- ============================================================================

alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.memberships   enable row level security;
alter table public.clients       enable row level security;
alter table public.engagements   enable row level security;
alter table public.appointments  enable row level security;
alter table public.documents     enable row level security;
alter table public.tasks         enable row level security;

-- organizations: members read their orgs; admins update.
create policy organizations_read  on public.organizations for select using (public.is_member(id));
create policy organizations_admin on public.organizations for update
  using (public.is_admin(id)) with check (public.is_admin(id));

-- profiles: yourself, plus anyone you share an org with (to render names).
create policy profiles_read        on public.profiles for select using (id = auth.uid() or public.shares_org(id));
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- memberships: see your own; staff read the org's; admins manage.
create policy memberships_read  on public.memberships for select using (user_id = auth.uid() or public.is_staff(org_id));
create policy memberships_admin on public.memberships for all
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));

-- clients: staff full; a client sees their own client row.
create policy clients_staff    on public.clients for all using (public.is_staff(org_id)) with check (public.is_staff(org_id));
create policy clients_own_read on public.clients for select using (profile_id = auth.uid());

-- engagements: staff full; client reads their own.
create policy engagements_staff    on public.engagements for all using (public.is_staff(org_id)) with check (public.is_staff(org_id));
create policy engagements_own_read on public.engagements for select using (client_id = public.my_client_id(org_id));

-- appointments: staff full; client reads their own.
create policy appointments_staff    on public.appointments for all using (public.is_staff(org_id)) with check (public.is_staff(org_id));
create policy appointments_own_read on public.appointments for select using (client_id = public.my_client_id(org_id));

-- tasks: internal (staff only).
create policy tasks_staff on public.tasks for all using (public.is_staff(org_id)) with check (public.is_staff(org_id));

-- documents: staff full; client reads own client_visible files, uploads to own.
create policy documents_staff       on public.documents for all using (public.is_staff(org_id)) with check (public.is_staff(org_id));
create policy documents_own_read    on public.documents for select
  using (client_id = public.my_client_id(org_id) and visibility = 'client_visible');
create policy documents_own_insert  on public.documents for insert
  with check (client_id = public.my_client_id(org_id) and uploaded_by = auth.uid());
