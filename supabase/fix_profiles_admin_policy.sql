create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function is_admin() to authenticated;

drop policy if exists "profiles can read own profile" on profiles;
drop policy if exists "admins manage profiles" on profiles;
drop policy if exists "admins can read profiles" on profiles;
drop policy if exists "admins can insert profiles" on profiles;
drop policy if exists "admins can update profiles" on profiles;
drop policy if exists "admins can delete profiles" on profiles;

create policy "profiles can read own profile"
on profiles for select
to authenticated
using (id = auth.uid());

create policy "admins can read profiles"
on profiles for select
to authenticated
using (public.is_admin());

create policy "admins can insert profiles"
on profiles for insert
to authenticated
with check (public.is_admin());

create policy "admins can update profiles"
on profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can delete profiles"
on profiles for delete
to authenticated
using (public.is_admin());
