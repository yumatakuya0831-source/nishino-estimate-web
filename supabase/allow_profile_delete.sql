alter table estimates
  drop constraint if exists estimates_created_by_fkey,
  add constraint estimates_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;

alter table price_import_batches
  drop constraint if exists price_import_batches_created_by_fkey,
  add constraint price_import_batches_created_by_fkey
    foreign key (created_by) references profiles(id) on delete set null;
