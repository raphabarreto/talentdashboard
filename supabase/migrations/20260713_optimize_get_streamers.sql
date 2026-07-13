-- Função otimizada que retorna streamers com status is_live em 1 query
-- Elimina o round-trip de 2 queries sequenciais
create or replace function get_streamers_with_live_status()
returns table (
  id uuid,
  name text,
  country text,
  avg_viewers integer,
  peak_viewers integer,
  hours_watched integer,
  hours_streamed integer,
  game_name text,
  created_at timestamptz,
  main_category text,
  last_live_at timestamptz,
  is_live boolean
) as $$
  select 
    s.id,
    s.name,
    s.country,
    s.avg_viewers,
    s.peak_viewers,
    s.hours_watched,
    s.hours_streamed,
    s.game_name,
    s.created_at,
    s.main_category,
    s.last_live_at,
    coalesce(
      (
        select ss.is_live
        from stream_snapshots ss
        where ss.streamer_id = s.id
        order by ss.captured_at desc
        limit 1
      ),
      false
    ) as is_live
  from streamers s
  order by s.avg_viewers desc
$$ language sql stable;
