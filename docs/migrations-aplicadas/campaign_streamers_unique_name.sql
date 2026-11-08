-- APLICADA em produção (Dash Lugs) em 07/11/2026, com autorização do usuário. Registro histórico.
--
-- Objetivo: impedir, no próprio banco, o mesmo streamer duas vezes na MESMA campanha
-- (ex.: duas abas salvando ao mesmo tempo). Campanhas diferentes continuam podendo ter o mesmo streamer.
-- O front já evita duplicatas e trata erro de gravação; este índice é só a rede de segurança final.
--
-- RESULTADO: antes, 193 linhas e 0 duplicatas; depois, índice válido e ativo, 0 duplicatas e dados idênticos (mesmo hash).
--
-- PASSO 1 — conferir se já existem duplicatas (somente leitura). Se retornar linhas, corrigir antes do passo 2,
-- senão a criação do índice falha (sem danificar nada):
--
--   select campaign_id, lower(trim(streamer_name)) as nome, count(*)
--   from campaign_streamers
--   group by 1, 2
--   having count(*) > 1;
--
-- PASSO 2 — criar o índice (rápido; não altera dados):
create unique index if not exists campaign_streamers_campaign_name_unique
  on campaign_streamers (campaign_id, lower(trim(streamer_name)));

-- ROLLBACK (desfaz por completo):
--   drop index if exists campaign_streamers_campaign_name_unique;
--
-- Observação sobre transação única: salvar campanha + participantes numa só transação exigiria uma função
-- no banco (RPC). A solução atual do front (sincronização por diferença, com erro explícito e idempotente)
-- nunca apaga quem permanece na lista e só remove quem saiu por último; por isso a RPC não foi considerada
-- necessária. Se, no futuro, for desejada atomicidade estrita, essa seria a evolução.
