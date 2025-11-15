-- Creates the table used to track external data source sync metadata.
-- Run via: supabase db push --file supabase/scripts/create_data_sources_table.sql

create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  data_source_type text not null,
  last_sync_time timestamptz,
  auth jsonb not null,
  created_at timestamptz not null default now()
);

