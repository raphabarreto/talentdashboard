-- =============================================
-- Talent Dashboard - Schema de referencia
-- Espelha o banco de producao (projeto Dash Lugs), conferido em 2026-11-03.
-- ATENCAO: para um banco novo, edite os e-mails da allowlist (secao 1) antes de rodar.
-- Em producao, alteracoes de estrutura exigem autorizacao e rollback (ver CLAUDE.md).
-- =============================================

-- =============================================
-- 1. Allowlist de usuarios (acesso controlado no banco, nao so no front)
-- =============================================
create table allowed_users (
  email text primary key
);
alter table allowed_users enable row level security;
-- Sem policies: ninguem le/escreve via API. Usada apenas por is_allowed_user().

-- insert into allowed_users (email) values ('seu-email@exemplo.com');

-- search_path fixo: evita que objetos em outros schemas sombreiem allowed_users
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.allowed_users
    where email = auth.jwt() ->> 'email'
  )
$$;

-- =============================================
-- 2. Tabelas
-- =============================================

-- Streamers monitorados
create table streamers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text default '',
  avg_viewers integer default 0,
  peak_viewers integer default 0,
  hours_watched integer default 0,
  hours_streamed integer default 0,
  game_name text default '',
  created_at timestamptz default now(),
  main_category text default '',
  last_live_at timestamptz
);
create unique index streamers_name_unique on streamers (lower(name));

-- Snapshots de coleta (a cada 15 min)
create table stream_snapshots (
  id uuid primary key default gen_random_uuid(),
  streamer_id uuid references streamers(id) on delete cascade,
  viewers integer default 0,
  is_live boolean default false,
  game text default '',
  captured_at timestamptz default now()
);
create index idx_snapshots_streamer_captured on stream_snapshots(streamer_id, captured_at);
create index idx_snapshots_live on stream_snapshots(is_live, captured_at);

-- Historico mensal por streamer
create table streamer_history (
  id uuid primary key default gen_random_uuid(),
  streamer_id uuid references streamers(id) on delete cascade,
  month text not null,
  avg_viewers integer default 0,
  peak_viewers integer default 0,
  hours_watched integer default 0,
  hours_streamed integer default 0,
  created_at timestamptz default now(),
  unique (streamer_id, month)
);

-- Campanhas (sem CHECK em currency no banco; a validacao BRL/USD e feita no front)
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now(),
  campaign_value numeric default 0,
  currency text default 'BRL',
  my_commission numeric default 0,
  payment_date date,
  total_received numeric(12,2),
  commission_percentage integer default 20,
  original_amount_usd numeric
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

-- =============================================
-- 3. Funcoes
-- (calculate_streamer_metrics: ver supabase/migrations/calculate_streamer_metrics.sql)
-- =============================================

-- Ultimo snapshot de cada streamer
create or replace function get_latest_snapshots(streamer_ids uuid[])
returns table (streamer_id uuid, is_live boolean) as $$
  select distinct on (streamer_id) streamer_id, is_live
  from stream_snapshots
  where streamer_id = any(streamer_ids)
  order by streamer_id, captured_at desc
$$ language sql stable;

-- Streamers com status is_live em 1 query
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

-- =============================================
-- 4. Row Level Security (RLS)
-- Acesso somente para e-mails da allowlist (is_allowed_user()).
-- NAO usar `auth.role() = 'authenticated'`: qualquer conta Google logada teria acesso total.
-- =============================================
alter table streamers enable row level security;
alter table stream_snapshots enable row level security;
alter table streamer_history enable row level security;
alter table campaigns enable row level security;
alter table campaign_streamers enable row level security;

create policy "Allow all for allowed users" on streamers for all using (is_allowed_user());
create policy "Allow all for allowed users" on stream_snapshots for all using (is_allowed_user());
create policy "Allow all for allowed users" on streamer_history for all using (is_allowed_user());
create policy "Allow all for allowed users" on campaigns for all using (is_allowed_user());
create policy "Allow all for allowed users" on campaign_streamers for all using (is_allowed_user());

-- =============================================
-- 5. Limpeza automatica de snapshots antigos (opcional)
-- Requer pg_cron (Database -> Extensions). Depois:
--
-- select cron.schedule(
--   'cleanup-old-snapshots',
--   '0 3 1 * *',
--   $$delete from stream_snapshots where captured_at < now() - interval '6 months'$$
-- );
-- (A Edge Function consolidate-daily tambem apaga snapshots com mais de 30 dias.)
