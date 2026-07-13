-- =============================================
-- Talent Dashboard v2 - Schema
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Streamers monitorados
create table streamers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text default '',
  avg_viewers int default 0,
  peak_viewers int default 0,
  hours_watched int default 0,
  hours_streamed int default 0,
  is_active boolean default true,
  main_category text default '',
  last_live_at timestamptz,
  created_at timestamptz default now()
);

-- Histórico mensal (métricas consolidadas)
create table streamer_history (
  id uuid primary key default gen_random_uuid(),
  streamer_id uuid references streamers(id) on delete cascade,
  month text not null, -- formato: '2026-06'
  avg_viewers int default 0,
  peak_viewers int default 0,
  hours_watched int default 0,
  hours_streamed int default 0,
  created_at timestamptz default now(),
  unique(streamer_id, month)
);

-- Snapshots de coleta (a cada 5 min)
create table stream_snapshots (
  id uuid primary key default gen_random_uuid(),
  streamer_id uuid references streamers(id) on delete cascade,
  viewers int default 0,
  is_live boolean default false,
  game text default '',
  captured_at timestamptz default now()
);

-- Índice pra queries de cálculo de métricas
create index idx_snapshots_streamer_captured on stream_snapshots(streamer_id, captured_at);
create index idx_snapshots_live on stream_snapshots(is_live, captured_at);

-- Função otimizada para buscar último snapshot de cada streamer
-- Muito mais rápido que buscar tudo e filtrar no client
create or replace function get_latest_snapshots(streamer_ids uuid[])
returns table (streamer_id uuid, is_live boolean) as $$
  select distinct on (streamer_id) streamer_id, is_live
  from stream_snapshots
  where streamer_id = any(streamer_ids)
  order by streamer_id, captured_at desc
$$ language sql stable;

-- Função otimizada que retorna streamers com status is_live em 1 query
-- Elimina o round-trip de 2 queries sequenciais (melhoria de performance ~50-70%)
create or replace function get_streamers_with_live_status()
returns table (
  id uuid,
  name text,
  country text,
  avg_viewers integer,
  peak_viewers integer,
  hours_watched integer,
  hours_streamed integer,
  main_category text,
  last_live_at timestamptz,
  created_at timestamptz,
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
    s.main_category,
    s.last_live_at,
    s.created_at,
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

-- Campanhas
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  start_date date not null,
  end_date date not null,
  total_received numeric default 0,
  total_paid numeric default 0,
  currency text default 'BRL' check (currency in ('BRL', 'USD')),
  commission_percentage numeric default 20,
  payment_date date,
  created_at timestamptz default now()
);

-- Streamers associados a campanhas
create table campaign_streamers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  streamer_name text not null,
  payment numeric(10,2) default 0,
  payment_date date,
  contact_status text default 'pendente' check (contact_status in ('pendente', 'contatado', 'nao_respondeu', 'confirmado', 'recusado')),
  email text default ''
);

-- Limpeza automática de snapshots antigos (> 6 meses)
-- Requer extensão pg_cron habilitada no Supabase (Database → Extensions → pg_cron)
-- Depois de habilitar, execute:
--
-- select cron.schedule(
--   'cleanup-old-snapshots',
--   '0 3 1 * *',  -- dia 1 de cada mês às 3h
--   $$delete from stream_snapshots where captured_at < now() - interval '6 months'$$
-- );

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Habilitar RLS nas tabelas principais
alter table streamers enable row level security;
alter table campaigns enable row level security;
alter table campaign_streamers enable row level security;
alter table streamer_history enable row level security;
alter table stream_snapshots enable row level security;

-- Policies: permitir tudo para usuários autenticados
create policy "Allow all for authenticated users"
  on streamers for all
  using (auth.role() = 'authenticated');

create policy "Allow all for authenticated users"
  on campaigns for all
  using (auth.role() = 'authenticated');

create policy "Allow all for authenticated users"
  on campaign_streamers for all
  using (auth.role() = 'authenticated');

create policy "Allow all for authenticated users"
  on streamer_history for all
  using (auth.role() = 'authenticated');

create policy "Allow all for authenticated users"
  on stream_snapshots for all
  using (auth.role() = 'authenticated');
