-- CostIQ — Estimates Table Migration
-- Run in Supabase Dashboard → SQL Editor → New query → paste & run

create table if not exists estimates (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  project_name  text not null,
  scenario_name text default 'Scenario A',
  status        text default 'not_started' check (status in ('not_started','in_progress','completed')),
  data          jsonb not null default '{}'
);

alter table estimates enable row level security;

create policy "authenticated access" on estimates
  for all using (auth.role() = 'authenticated');
