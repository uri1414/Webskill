-- ============================================================================
-- 001_schema.sql — minimum safe foundation (multi-tenant)
--
-- Non-negotiables baked in here (see references/foundation.md and
-- docs/adr/0001-request-engine.md):
--   * organizations = the tenant. Every business table carries org_id from day
--     one. A single-tenant deployment simply has ONE organizations row.
--   * identity vs. membership: profiles = the global person (NO org_id);
--     memberships = which org a person belongs to and their role there. A person
--     may belong to more than one org.
--   * org-aware SECURITY DEFINER helpers back all RLS (see 002_rls.sql).
--
-- Customize the domain tables (clients / engagements / appointments / ...) per
-- client. Do NOT remove org_id or the membership model — that is the safety
-- foundation, not a per-client choice.
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- organizations -------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();

-- profiles = global identity (one row per auth user; NO org_id) --------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create the profile automatically on signup. Membership is granted separately
-- (via invite/onboarding) — identity is global, org access is deliberate.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- memberships = person <-> org <-> role -------------------------------------
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'staff' check (role in ('admin','staff','client')),
  status     text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_org_idx  on public.memberships(org_id);
create trigger memberships_touch before update on public.memberships
  for each row execute function public.touch_updated_at();

-- clients = the practice's customers (may or may not have a login) -----------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete set null, -- login, when they have one
  first_name    text,
  last_name     text,
  business_name text,
  email         text,
  phone         text,
  status        text not null default 'active' check (status in ('prospect','active','inactive')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists clients_org_idx     on public.clients(org_id);
create index if not exists clients_profile_idx on public.clients(profile_id);
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- Org-aware helpers. SECURITY DEFINER + stable; used by every RLS policy.
-- Each takes the ROW's org_id and asks "is the caller allowed in that org?",
-- which is naturally correct for a person who belongs to several orgs.
create or replace function public.is_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = org and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.is_staff(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = org and m.user_id = auth.uid()
                   and m.status = 'active' and m.role in ('admin','staff'));
$$;

create or replace function public.is_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = org and m.user_id = auth.uid()
                   and m.status = 'active' and m.role = 'admin');
$$;

create or replace function public.my_client_id(org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select c.id from public.clients c
  where c.org_id = org and c.profile_id = auth.uid() limit 1;
$$;

-- True when the caller shares any org with `other` (used to show names).
create or replace function public.shares_org(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = other and b.status = 'active'
  );
$$;

-- engagements = a unit of professional work (core spine) --------------------
create table if not exists public.engagements (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  type        text,
  title       text,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists engagements_org_idx    on public.engagements(org_id);
create index if not exists engagements_client_idx on public.engagements(client_id);
create trigger engagements_touch before update on public.engagements
  for each row execute function public.touch_updated_at();

-- appointments --------------------------------------------------------------
create table if not exists public.appointments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete set null,
  staff_id      uuid references public.profiles(id) on delete set null,
  title         text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  status        text not null default 'scheduled',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists appointments_org_idx   on public.appointments(org_id);
create index if not exists appointments_start_idx on public.appointments(starts_at);
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

-- documents (metadata; bytes live in Storage — see 004_storage.sql) ---------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete set null,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  name          text,
  folder        text not null default 'General',
  storage_path  text not null,
  visibility    text not null default 'client_visible' check (visibility in ('client_visible','staff_only')),
  created_at    timestamptz not null default now()
);
create index if not exists documents_org_idx    on public.documents(org_id);
create index if not exists documents_client_idx on public.documents(client_id);

-- tasks (internal prep/work) ------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete cascade,
  assignee_id   uuid references public.profiles(id) on delete set null,
  title         text not null,
  status        text not null default 'todo' check (status in ('todo','in_progress','done','blocked')),
  due_at        timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tasks_org_idx      on public.tasks(org_id);
create index if not exists tasks_assignee_idx on public.tasks(assignee_id);
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
