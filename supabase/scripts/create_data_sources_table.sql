-- Creates the table used to track external data source sync metadata.
-- Run via: supabase db push --file supabase/scripts/create_data_sources_table.sql

drop table if exists data_sources;

create table data_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_source_type text not null,
  last_sync_time timestamptz,
  auth jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_data_sources_user_id on data_sources(user_id);

