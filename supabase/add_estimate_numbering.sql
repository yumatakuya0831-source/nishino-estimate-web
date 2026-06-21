-- Adds database-backed estimate number sequencing.
-- Run this on an existing Supabase project instead of re-running the full schema.sql.

begin;

create table if not exists estimate_number_sequences (
  year integer primary key,
  current_value integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table estimate_number_sequences enable row level security;

create unique index if not exists estimates_estimate_no_idx on estimates (estimate_no);

drop policy if exists "authenticated read estimate number sequences" on estimate_number_sequences;
create policy "authenticated read estimate number sequences"
on estimate_number_sequences
for select
to authenticated
using (true);

create or replace function next_estimate_number(pattern_arg text default 'YYYY-0001')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_year integer := extract(year from now())::integer;
  target_month text := to_char(now(), 'MM');
  next_value integer;
  result text;
begin
  insert into estimate_number_sequences (year, current_value, updated_at)
  values (target_year, 1, now())
  on conflict (year) do update set
    current_value = estimate_number_sequences.current_value + 1,
    updated_at = now()
  returning current_value into next_value;

  result := replace(pattern_arg, 'YYYY', target_year::text);
  result := replace(result, 'MM', target_month);
  result := replace(result, '0001', lpad(next_value::text, 4, '0'));

  return result;
end;
$$;

grant execute on function next_estimate_number(text) to authenticated;

commit;
