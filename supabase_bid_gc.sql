-- CostIQ — Add bid_gc to project_costs
-- Run in Supabase Dashboard → SQL Editor → New query → paste & run

ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS bid_gc text;
