-- Remove a coluna sem uso campaign_streamers.email.
-- Aplicada em produção (Dash Lugs) em 2026-11-07, com autorização do usuário.
-- Estado antes: 194 linhas, todas com email vazio; nenhuma view, função ou policy dependia da coluna;
-- front e Edge Functions não a usavam.
alter table public.campaign_streamers drop column email;

-- Rollback (recria a coluna vazia, como era):
-- alter table public.campaign_streamers add column email text default '';
