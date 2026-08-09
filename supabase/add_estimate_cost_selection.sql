alter table estimate_items
  add column if not exists include_material_cost boolean not null default true,
  add column if not exists include_labor_cost boolean not null default true;

comment on column estimate_items.include_material_cost is
  '見積明細の材料費を単価と金額へ含めるか';
comment on column estimate_items.include_labor_cost is
  '見積明細の労務費を単価と金額へ含めるか';
