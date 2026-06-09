-- Bid Leveling tables for CostIQ
-- Run in Supabase: Dashboard → SQL Editor → paste & run

create table if not exists bid_leveling (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  project_name  text not null,
  project_id    uuid references projects(id) on delete set null,
  file_name     text,
  bid_date      date,
  unit_count    numeric,
  bidders       text[] not null default '{}',
  notes         text
);

create table if not exists bid_line_items (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  bid_id        uuid references bid_leveling(id) on delete cascade,
  sort_order    integer default 0,
  code          text,
  category      text not null,
  amounts       jsonb not null default '{}',
  row_type      text default 'line_item'
    check (row_type in ('line_item', 'subtotal', 'total'))
);

alter table bid_leveling   enable row level security;
alter table bid_line_items enable row level security;

create policy "authenticated access" on bid_leveling
  for all using (auth.role() = 'authenticated');

create policy "authenticated access" on bid_line_items
  for all using (auth.role() = 'authenticated');
