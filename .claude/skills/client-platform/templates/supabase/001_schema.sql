-- 001 core schema. Customize the entity tables to the client's domain.

-- profiles: one row per auth user, carries the role that drives routing.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'client',   -- 'client' | 'staff' | 'admin'
  created_at timestamptz not null default now()
);

-- Create a profile automatically on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.raw_user_meta_data->>'role','client'))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Example domain tables (edit for the client). A CPA practice, for instance:
create table if not exists public.appointments (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.profiles(id) on delete cascade,
  staff_id   uuid references public.profiles(id) on delete set null,
  title      text,
  starts_at  timestamptz,
  status     text not null default 'scheduled', -- scheduled | checked_in | completed | no_show | canceled
  fee        numeric,
  payment_status text not null default 'unpaid', -- unpaid | deposit | paid
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.profiles(id) on delete set null,
  category   text,
  file_path  text not null,
  file_name  text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.profiles(id) on delete cascade,
  label      text not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
