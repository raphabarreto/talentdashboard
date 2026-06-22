-- Adicionar coluna last_live_at
ALTER TABLE streamers ADD COLUMN last_live_at TIMESTAMPTZ;

-- Preencher last_live_at com base nos snapshots existentes
UPDATE streamers SET last_live_at = (
  SELECT MAX(captured_at) FROM stream_snapshots
  WHERE stream_snapshots.streamer_id = streamers.id AND is_live = true
);

-- Remover coluna is_active (não mais necessária)
ALTER TABLE streamers DROP COLUMN IF EXISTS is_active;
