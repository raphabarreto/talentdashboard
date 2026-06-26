-- Migration: Adicionar função otimizada para buscar últimos snapshots
-- Execute no Supabase SQL Editor

-- Função otimizada para buscar último snapshot de cada streamer
-- Usa DISTINCT ON que é muito mais eficiente que buscar tudo
create or replace function get_latest_snapshots(streamer_ids uuid[])
returns table (streamer_id uuid, is_live boolean) as $$
  select distinct on (streamer_id) streamer_id, is_live
  from stream_snapshots
  where streamer_id = any(streamer_ids)
  order by streamer_id, captured_at desc
$$ language sql stable;
