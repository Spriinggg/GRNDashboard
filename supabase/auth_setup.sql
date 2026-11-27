-- US Pizza Food Control: tables, roles and row-level security.
-- Run once in the Supabase SQL editor. Review before running: it enables RLS on `datasets`,
-- which blocks anonymous access, so only signed-in users can read or write data.

create table if not exists public.datasets (
  id text primary key,
  outlet text,
  outlet_key text,
  date text,
  data jsonb
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin'))
);

create table if not exists public.delete_requests (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null,
  outlet text,
  date text,
  requested_by uuid references auth.users (id),
  requester_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz
);

-- Every new sign-up gets a Staff profile. Admins are promoted by hand (see the end of this file).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role) values (new.id, new.email, 'user') on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- The requester id always comes from the session, never from the client.
create or replace function public.set_requester() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.requested_by := auth.uid();
  new.status := 'pending';
  return new;
end $$;
drop trigger if exists delete_requests_set_requester on public.delete_requests;
create trigger delete_requests_set_requester before insert on public.delete_requests for each row execute function public.set_requester();

alter table public.datasets enable row level security;
alter table public.profiles enable row level security;
alter table public.delete_requests enable row level security;

-- datasets: any signed-in user can read, add and update; only admins can delete. Anonymous users get nothing.
drop policy if exists datasets_select on public.datasets;
drop policy if exists datasets_insert on public.datasets;
drop policy if exists datasets_update on public.datasets;
drop policy if exists datasets_delete on public.datasets;
create policy datasets_select on public.datasets for select to authenticated using (true);
create policy datasets_insert on public.datasets for insert to authenticated with check (true);
create policy datasets_update on public.datasets for update to authenticated using (true) with check (true);
create policy datasets_delete on public.datasets for delete to authenticated using (public.is_admin());

-- profiles: read your own row (admins read all). Nobody can change a role from the app.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());

-- delete_requests: staff file and see their own; admins see and resolve all.
drop policy if exists dr_select on public.delete_requests;
drop policy if exists dr_insert on public.delete_requests;
drop policy if exists dr_update on public.delete_requests;
create policy dr_select on public.delete_requests for select to authenticated using (requested_by = auth.uid() or public.is_admin());
create policy dr_insert on public.delete_requests for insert to authenticated with check (true);
create policy dr_update on public.delete_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Make yourself an admin (replace the email), then sign out and in again:
-- insert into public.profiles (id, email, role)
-- select id, email, 'admin' from auth.users where email = 'your@email.com'
-- on conflict (id) do update set role = 'admin';
