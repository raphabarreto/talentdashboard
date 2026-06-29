-- Função para calcular métricas de streamers dos últimos 30 dias
-- Resolve o problema do limit de 1000 registros do Supabase JS

CREATE OR REPLACE FUNCTION calculate_streamer_metrics(start_date timestamptz)
RETURNS TABLE (
  streamer_id uuid,
  avg_viewers integer,
  peak_viewers integer,
  hours_streamed integer,
  hours_watched integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.streamer_id,
    COALESCE(ROUND(AVG(ss.viewers) FILTER (WHERE ss.is_live = true))::integer, 0) as avg_viewers,
    COALESCE(MAX(ss.viewers) FILTER (WHERE ss.is_live = true), 0) as peak_viewers,
    COALESCE(ROUND((COUNT(*) FILTER (WHERE ss.is_live = true) * 15.0) / 60.0)::integer, 0) as hours_streamed,
    COALESCE(ROUND((SUM(ss.viewers * 15) FILTER (WHERE ss.is_live = true)) / 60.0)::integer, 0) as hours_watched
  FROM stream_snapshots ss
  WHERE ss.captured_at >= start_date
  GROUP BY ss.streamer_id;
END;
$$ LANGUAGE plpgsql;
