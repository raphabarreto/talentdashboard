-- =============================================
-- Migration: RLS por allowlist de email
-- Execute este SQL no Supabase SQL Editor
-- =============================================
--
-- Problema corrigido: as policies atuais usam `auth.role() = 'authenticated'`,
-- ou seja, qualquer conta Google que faça login recebe um JWT valido e tem
-- acesso total (SELECT/INSERT/UPDATE/DELETE) a todas as tabelas via API do
-- Supabase, mesmo que o email nao esteja na lista de VITE_ALLOWED_EMAILS
-- (que hoje so e checada no front-end).
--
-- Esta migration cria uma tabela `allowed_users` no banco e troca as policies
-- para checar o email do JWT contra essa lista.

-- 1. Criar tabela de allowlist
create table if not exists allowed_users (
  email text primary key
);

alter table allowed_users enable row level security;

-- Ninguem pode ler/escrever essa tabela via API (nem authenticated) --
-- ela so e usada internamente pelas policies abaixo via subquery.
-- Nao criamos nenhuma policy de acesso nela = acesso bloqueado por padrao.

-- 2. Emails permitidos (mesma lista de VITE_ALLOWED_EMAILS do .env / Vercel)
--    Substitua pelos emails reais do seu projeto antes de rodar.
insert into allowed_users (email) values
  ('seu-email-1@exemplo.com'),
  ('seu-email-2@exemplo.com')
on conflict (email) do nothing;

-- 3. Funcao helper: verifica se o email do JWT atual esta na allowlist
create or replace function is_allowed_user()
returns boolean as $$
  select exists (
    select 1 from allowed_users
    where email = auth.jwt() ->> 'email'
  )
$$ language sql stable security definer;

-- 4. Substituir as policies antigas pelas novas (checando allowlist)

drop policy if exists "Allow all for authenticated users" on streamers;
create policy "Allow all for allowed users"
  on streamers for all
  using (is_allowed_user());

drop policy if exists "Allow all for authenticated users" on campaigns;
create policy "Allow all for allowed users"
  on campaigns for all
  using (is_allowed_user());

drop policy if exists "Allow all for authenticated users" on campaign_streamers;
create policy "Allow all for allowed users"
  on campaign_streamers for all
  using (is_allowed_user());

drop policy if exists "Allow all for authenticated users" on streamer_history;
create policy "Allow all for allowed users"
  on streamer_history for all
  using (is_allowed_user());

drop policy if exists "Allow all for authenticated users" on stream_snapshots;
create policy "Allow all for allowed users"
  on stream_snapshots for all
  using (is_allowed_user());

-- =============================================
-- Como testar depois de rodar:
-- 1. Logue no dashboard normalmente com um email da lista -> deve continuar
--    funcionando exatamente igual.
-- 2. (Opcional) Peca para alguem de fora da lista tentar logar com Google:
--    o front-end ja bloqueia a tela, mas agora o banco tambem bloqueia
--    qualquer tentativa de acesso direto via API.
-- =============================================
