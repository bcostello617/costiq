-- CostIQ — Supabase Schema
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste & run

-- ─────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────

create table if not exists cost_categories (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  category_name   text not null,
  csi_division    text,
  category_group  text check (category_group in (
    'Site & Civil','Structure','Building Envelope','MEP Systems',
    'Interior Finishes','Vertical Transportation','General & Administrative','Other'
  )),
  description text,
  sort_order  numeric
);

create table if not exists projects (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz default now(),
  project_name      text not null,
  project_number    text,
  city              text,
  state             text,
  market            text,
  address           text,
  product_type      text check (product_type in (
    'Garden','Wrap','Podium','Mid-Rise','High-Rise','Townhome',
    'Mixed-Use','Senior Living','Student Housing','Affordable','Other'
  )),
  construction_type text check (construction_type in (
    'Wood Frame','Steel Frame','Concrete','Hybrid','Modular','Tilt-Wall','Other'
  )),
  podium_type       text check (podium_type in (
    'None','Concrete Podium','Steel Podium','PT Slab','Other'
  )),
  unit_count        numeric,
  building_count    numeric,
  site_acres        numeric,
  gross_sf          numeric,
  net_rentable_sf   numeric,
  start_date        date,
  completion_date   date,
  developer         text,
  general_contractor text,
  architect         text,
  status            text default 'Planning' check (status in (
    'Planning','Pre-Construction','Under Construction','Completed','On Hold'
  )),
  total_hard_cost   numeric,
  notes             text
);

create table if not exists project_costs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  project_id    uuid references projects(id) on delete cascade,
  category_id   uuid references cost_categories(id) on delete set null,
  category_name text,
  total_cost    numeric not null,
  cost_per_unit numeric,
  cost_per_sf   numeric,
  percent_of_total numeric,
  cost_date     date,
  notes         text
);

create table if not exists import_logs (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  file_name           text not null,
  file_url            text,
  status              text default 'pending' check (status in ('pending','processing','completed','failed')),
  projects_imported   integer default 0,
  costs_imported      integer default 0,
  categories_imported integer default 0,
  errors              jsonb,
  import_summary      text
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- By default all data is accessible to authenticated users.
-- Tighten per-user isolation later by adding user_id columns if needed.
-- ─────────────────────────────────────────

alter table cost_categories  enable row level security;
alter table projects         enable row level security;
alter table project_costs    enable row level security;
alter table import_logs      enable row level security;

-- Allow any authenticated user to read/write all rows
create policy "authenticated access" on cost_categories
  for all using (auth.role() = 'authenticated');

create policy "authenticated access" on projects
  for all using (auth.role() = 'authenticated');

create policy "authenticated access" on project_costs
  for all using (auth.role() = 'authenticated');

create policy "authenticated access" on import_logs
  for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- OPTIONAL: seed some cost categories
-- ─────────────────────────────────────────

insert into cost_categories (category_name, category_group, csi_division, sort_order) values
  ('Site Work',             'Site & Civil',          '02',  1),
  ('Concrete',              'Structure',              '03',  2),
  ('Masonry',               'Structure',              '04',  3),
  ('Structural Steel',      'Structure',              '05',  4),
  ('Rough Carpentry',       'Structure',              '06',  5),
  ('Roofing',               'Building Envelope',      '07',  6),
  ('Windows & Glazing',     'Building Envelope',      '08',  7),
  ('Finishes',              'Interior Finishes',      '09',  8),
  ('Plumbing',              'MEP Systems',            '22',  9),
  ('HVAC',                  'MEP Systems',            '23', 10),
  ('Electrical',            'MEP Systems',            '26', 11),
  ('Elevators',             'Vertical Transportation', '14', 12),
  ('General Conditions',    'General & Administrative','01', 13),
  ('General Contractor Fee','General & Administrative','01', 14)
on conflict do nothing;
