-- =============================================
-- Migration: fixar search_path em is_allowed_user()
-- NAO foi executada em producao. Rodar no SQL Editor do Supabase
-- somente com autorizacao explicita.
-- =============================================
--
-- Problema: is_allowed_user() e `security definer` (roda com os privilegios do
-- dono) e nao fixa o search_path. Quem conseguir criar objetos em um schema que
-- venha antes de `public` no caminho de busca poderia sombrear `allowed_users`
-- e fazer a funcao devolver `true`. Fixar o search_path elimina esse risco.
--
-- `create or replace` mantem os GRANTs existentes e as policies que a usam.

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

-- Como conferir depois de rodar (somente leitura):
--   select proconfig from pg_proc where proname = 'is_allowed_user';
--   -- esperado: {search_path=public, pg_temp}
--   select has_function_privilege('authenticated', 'public.is_allowed_user()', 'execute');
--   -- esperado: true
--
-- Rollback (volta a definicao anterior):
--   create or replace function public.is_allowed_user()
--   returns boolean language sql stable security definer
--   as $$ select exists (select 1 from allowed_users where email = auth.jwt() ->> 'email') $$;
