-- 002 Row Level Security. Clients see their own rows; staff/admin see all.

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('staff','admin'));
$$;

alter table public.profiles     enable row level security;
alter table public.appointments enable row level security;
alter table public.documents    enable row level security;
alter table public.tasks        enable row level security;

-- profiles: you can read/update your own; staff read all.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid());

-- appointments: client sees own; staff see + write all; client may create own.
drop policy if exists appt_read on public.appointments;
create policy appt_read on public.appointments for select using (client_id = auth.uid() or public.is_staff());
drop policy if exists appt_client_insert on public.appointments;
create policy appt_client_insert on public.appointments for insert with check (client_id = auth.uid() or public.is_staff());
drop policy if exists appt_staff_write on public.appointments;
create policy appt_staff_write on public.appointments for update using (public.is_staff());

-- documents: owner + staff read; owner inserts own.
drop policy if exists docs_read on public.documents;
create policy docs_read on public.documents for select using (client_id = auth.uid() or public.is_staff());
drop policy if exists docs_insert on public.documents;
create policy docs_insert on public.documents for insert with check (client_id = auth.uid());

-- tasks: staff only.
drop policy if exists tasks_staff on public.tasks;
create policy tasks_staff on public.tasks for all using (public.is_staff()) with check (public.is_staff());
