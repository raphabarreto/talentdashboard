-- Habilitar Row Level Security (RLS)
-- Execute este SQL no Supabase SQL Editor

-- Habilitar RLS nas tabelas principais
ALTER TABLE streamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_streamers ENABLE ROW LEVEL SECURITY;
ALTER TABLE streamer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_snapshots ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Allow all for authenticated users" ON streamers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON campaigns;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON campaign_streamers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON streamer_history;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON stream_snapshots;

-- Criar policies: permitir tudo para usuários autenticados
CREATE POLICY "Allow all for authenticated users"
  ON streamers FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users"
  ON campaigns FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users"
  ON campaign_streamers FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users"
  ON streamer_history FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users"
  ON stream_snapshots FOR ALL
  USING (auth.role() = 'authenticated');
