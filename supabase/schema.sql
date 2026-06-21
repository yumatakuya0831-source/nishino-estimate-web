create extension if not exists "pgcrypto";

create type user_role as enum ('admin', 'user');
create type estimate_status as enum ('draft', 'issued');
create type price_import_status as enum ('parsed', 'reviewed', 'applied', 'failed');
create type price_diff_type as enum ('add', 'update', 'delete_candidate', 'uncertain');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role user_role not null default 'user',
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  honorific text not null default '御中',
  price_coefficient numeric(10, 4) not null default 1,
  address text not null default '',
  phone text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table work_categories (
  id text primary key,
  name text not null,
  sort_order integer not null,
  active boolean not null default true
);

create table company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  postal_code text not null,
  address text not null,
  tel text not null,
  fax text not null,
  default_expense_rate numeric(8, 4) not null default 0.15,
  estimate_number_pattern text not null default 'YYYY-0001'
);

create table price_items (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  page_no integer not null default 0,
  name text not null,
  specification text not null default '',
  note text not null default '',
  construction text not null default '',
  unit text not null default '式',
  material_unit_price numeric(14, 2) not null default 0,
  material_cost numeric(14, 2) not null default 0,
  labor_cost numeric(14, 2) not null default 0,
  expense numeric(14, 2) not null default 0,
  composite_unit_price numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index price_items_search_idx on price_items using gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(specification, '') || ' ' || coalesce(note, '') || ' ' || coalesce(construction, ''))
);

create table estimates (
  id uuid primary key default gen_random_uuid(),
  estimate_no text not null,
  customer_id uuid references customers(id),
  customer_name_snapshot text not null,
  customer_honorific_snapshot text not null default '御中',
  price_coefficient_snapshot numeric(10, 4) not null default 1,
  project_name text not null,
  payment_terms text not null default '打合せによる',
  valid_until date,
  expense_rate numeric(8, 4) not null default 0.15,
  status estimate_status not null default 'draft',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  work_category_id text not null references work_categories(id),
  price_item_id uuid references price_items(id),
  name text not null,
  specification text not null default '',
  quantity numeric(14, 4) not null default 1,
  unit text not null default '式',
  material_cost numeric(14, 2) not null default 0,
  labor_cost numeric(14, 2) not null default 0,
  expense numeric(14, 2) not null default 0,
  unit_price numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null default 0,
  memo text not null default '',
  sort_order integer not null default 0
);

create table price_import_batches (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  file_path text not null default '',
  file_name text not null,
  status price_import_status not null default 'parsed',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table price_import_diffs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references price_import_batches(id) on delete cascade,
  diff_type price_diff_type not null,
  current_item_id uuid references price_items(id),
  parsed_data jsonb not null,
  selected boolean not null default false,
  confidence numeric(5, 4) not null default 0,
  reason text not null default ''
);

alter table profiles enable row level security;
alter table customers enable row level security;
alter table work_categories enable row level security;
alter table company_settings enable row level security;
alter table price_items enable row level security;
alter table estimates enable row level security;
alter table estimate_items enable row level security;
alter table price_import_batches enable row level security;
alter table price_import_diffs enable row level security;

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create policy "profiles can read own profile" on profiles for select using (id = auth.uid() or is_admin());
create policy "admins manage profiles" on profiles for all using (is_admin()) with check (is_admin());

create policy "authenticated read customers" on customers for select to authenticated using (true);
create policy "admins manage customers" on customers for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated read work categories" on work_categories for select to authenticated using (true);
create policy "admins manage work categories" on work_categories for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated read company settings" on company_settings for select to authenticated using (true);
create policy "admins manage company settings" on company_settings for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated read price items" on price_items for select to authenticated using (true);
create policy "admins manage price items" on price_items for all to authenticated using (is_admin()) with check (is_admin());

create policy "authenticated manage estimates" on estimates for all to authenticated using (true) with check (true);
create policy "authenticated manage estimate items" on estimate_items for all to authenticated using (true) with check (true);

create policy "admins manage import batches" on price_import_batches for all to authenticated using (is_admin()) with check (is_admin());
create policy "admins manage import diffs" on price_import_diffs for all to authenticated using (is_admin()) with check (is_admin());

insert into work_categories (id, name, sort_order, active) values
  ('water', '給水設備工事', 1, true),
  ('drain', '排水通気設備工事', 2, true),
  ('hotWater', '給湯設備工事', 3, true),
  ('sanitary', '衛生器具設備工事', 4, true),
  ('airConditioning', '空調設備工事', 5, true),
  ('ventilation', '換気設備工事', 6, true),
  ('fire', '消火設備工事', 7, true),
  ('gas', 'ガス設備工事', 8, true),
  ('other', 'その他設備工事', 9, true)
on conflict (id) do nothing;

insert into company_settings (
  company_name,
  postal_code,
  address,
  tel,
  fax,
  default_expense_rate,
  estimate_number_pattern
) values (
  '有限会社　ニシノ設備工業',
  '336-0043',
  '埼玉県さいたま市南区大字円正寺210番地3',
  '048-813-6350',
  '048-813-6351',
  0.15,
  'YYYY-0001'
);
