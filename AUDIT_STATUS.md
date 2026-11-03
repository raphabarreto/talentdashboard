# AUDIT_STATUS — Talent Dashboard

Atualizado em 2026-11-02. Base: main @ 06d2b85. Sem segredos neste arquivo.
Legenda: [ok] confirmado no repo/testes · [usuário] informado pelo usuário · [a verificar]

## Concluído
- RLS por allowlist de e-mail (`is_allowed_user()`) nas tabelas: [usuário] aplicado em produção;
  [ok] confirmado via `pg_policies` em produção (03/11): 5 tabelas usam `is_allowed_user()`; `allowed_users` com RLS e 3
  `schema.sql` e `docs/DATABASE.md` atualizados para refletir a produção (03/11) e a allowlist.
- CRON_SECRET fail-closed em `collect-snapshots` e `consolidate-daily` (PR #1): [ok] código na main;
  [ok] deploy manual (CLI 2.108.0, 02/11) e POST sem credenciais retornou 401 nas duas.
- `update-last-live` grava com o JWT do usuário (RLS), não service role (PR #3): [ok] na main.
  [a verificar] deploy em produção (workflow) e `GRANT UPDATE` de `authenticated` em `streamers`.
- Workflow de deploy: CLI fixada em 2.108.0 e `supabase` direto, sem `npx` (PR #1): [ok] código;
  [ok] job no GitHub Actions com sucesso (merge do PR #4).
- CLAUDE.md criado (PR #2).
- XSS: `escapeHtml` (`src/lib/escape.ts`, com teste) aplicado nos campos de texto interpolados em
  `innerHTML` (`src/ui`, `src/events/campaigns.ts`) (PR #7): [ok] na main, testes, tsc e build; [ok] deploy Vercel de produção com sucesso (02/11).
  Não escapados: `id` (UUID do banco) e constantes. [a verificar] teste manual no navegador com nome
  malicioso (teste visual pendente); `src/lib/logger.ts` usa só HTML estático.
- Dependências (`npm audit fix`, sem `--force`): `dompurify` 3.4.11→3.4.17, `zod` 4.4.3→4.6.7, `vite`,
  `postcss`, `nanoid`, `source-map-js` atualizados (só `package-lock.json`). [ok] testes 39/39, `tsc` e build.
  Restam 4 (3 moderadas, 1 alta), só dev: `vitest`/`@vitest/mocker`/`happy-dom`; exigem `--force` (versão
  maior), não aplicado. Não chegam ao navegador. (PR #9) [ok] na main; [ok] deploy Vercel de produção com sucesso (02/11). [usuário] geração de PDF funcionando em produção (03/11).
- Falhas da Twitch: `collect-snapshots` aborta sem gravar se token ou consulta falhar (antes gravava todos
  como "offline") e checa o resultado dos `insert`/`update`; `twitch-proxy` valida token e toda resposta da
  Twitch e responde 502 (antes devolvia lista vazia). [ok] testes 44/44 (5 novos), `tsc` e build.
  (PR #11) [ok] na main; [ok] job "Deploy Edge Functions" com sucesso (02/11). [a verificar] busca de streamer em produção. Efeito: em falha da Twitch o cron não grava aquela rodada (lacuna, não dado falso).
- Headers de segurança (`vercel.json`): nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS
  (1 ano) e CSP (Report-Only no PR #13; bloqueante no PR #22). `onclick` inline do menu do
  card (`src/ui/overview.ts`) trocado por listener. (PR #13) [ok] na main, testes 44/44, `tsc` e build; [ok] deploy
  Vercel de produção e cabeçalhos confirmados via `curl` (02/11). [usuário] console em produção mostrou 1
  violação: `unsafe-eval` (Zod testa `new Function`; tem fallback, não precisa liberar eval). Correção:
  `z.config({ jitless: true })` em `src/lib/validators.ts` + teste (PR #16) [ok] na main; [ok] deploy Vercel de produção com sucesso (03/11). [a verificar] aviso sumiu do console.
  [a verificar] demais violações e domínio do Sentry (`*.ingest.sentry.io` presumido); depois trocar para
  `Content-Security-Policy` (bloqueante) em PR separado.
- `is_allowed_user()` com `search_path` fixado (`public, pg_temp`): [ok] executado em produção (Dash Lugs) em 03/11 com
  autorização; validado: `proconfig` ok, `authenticated` mantém EXECUTE, 5 policies intactas, allowlist com 3 e-mails.
  Rollback salvo fora do repositório. [usuário] conferir dashboard após a alteração.
- `consolidate-daily`: só apaga snapshots antigos se todos os updates deram certo; reporta falhas (500) e erro da
  limpeza; `cleaned` agora é verdadeiro de fato. [ok] testes 44/44 (3 novos), `tsc` e build. Reversão: revert do PR.
- Node: CI em Node 22 (antes 20), `.nvmrc` = 22 e `engines.node >=20` (PR de `chore/node-version`). Compatível com vite,
  vitest e happy-dom instalados. [ok] testes 44/44 e build local (Node 26); [a verificar] `test.yml` no CI com Node 22 (roda no PR).
- `supabase-js` fixado em `2.118.0` nas 4 Edge Functions (era `@2` flutuante; `@2` já resolvia para essa versão no
  esm.sh, sem mudança de comportamento). [ok] testes 44/44, `tsc` e build. Reversão: revert do PR.
- `supabase/.temp/` removido do Git e adicionado ao `.gitignore` (estado local do CLI; o workflow de deploy usa o
  secret `SUPABASE_PROJECT_ID`, não esses arquivos). Reversão: revert do PR.
- Docs de banco: `schema.sql` reescrito espelhando a produção (tabelas, `streamer_history`, `allowed_users`, funções,
  policies com `is_allowed_user()`; antes trazia as policies antigas inseguras) e `docs/DATABASE.md` alinhado. Conferido
  por consultas somente leitura ao Dash Lugs. Nenhuma alteração no banco. Reversão: revert do PR.
- `twitchtracker` (`fetchInitialStats`): nome codificado na URL, tempo limite de 8 s (`AbortController`) e falhas registradas
  como aviso (continua retornando `null`, sem quebrar o cadastro). Mantido no navegador (API não oficial; mover para o servidor
  não compensa). [ok] testes 48/48 (4 novos), `tsc` e build. [usuário] cadastro de streamer novo funcionando em produção (03/11).
- `twitch-proxy`: exige `is_allowed_user()` via RPC com o JWT do usuário (403 se fora da allowlist) e
  encode/regex de `language`/`game_id`/`after`/`user_id` (PR #4): [ok] na main, testes 36/36, build e
  `tsc` ok, job "Deploy Edge Functions" com sucesso (02/11). [usuário] `is_allowed_user()` executável por
  `authenticated` (true) e busca de streamers funcionando em produção. [a verificar] 403 com conta fora
  da allowlist (não testado).
- Favicon/manifest: `favicon.png` e `manifest.json` movidos para `public/` (antes davam 404 em produção; o manifest nem entrava no build). [ok] testes 48/48, `tsc` e build (dist contém ambos). [ok] PR #31 na main; deploy Vercel de produção com sucesso e `/favicon.png` e `/manifest.json` respondem 200 (03/11). Reversão: revert do PR.

## Pendente (por prioridade)
Baixa
1. Zod 3.23.8 nas functions vs Zod 4 no front (aceito: versões já fixas; unificar só se necessário).
2. `deno.json` das functions com imports não usados (aceito: inofensivo; remover mexeria no empacotamento do deploy sem ganho).
3. Migrations sem padrão de nome (`migration_*.sql` na raiz vs `supabase/migrations/`); apenas organização, sem risco.

## Tarefa atual
Nenhuma correção em andamento. Pendências restantes são itens aceitos (Zod 3/4, deno.json, nomes de migrations) e verificações manuais "a verificar".

## Próximo passo sugerido
Verificações manuais pelo usuário (ver "a verificar"): CSP bloqueante (navegar por todas as abas), 403 de conta fora da allowlist, `update-last-live` e `GRANT UPDATE`. Revisão periódica: `npm audit` (restam 4 avisos só de dev, exigem `--force`). Considerar `supabase logout` ao encerrar.

## Testes (main @ 06d2b85)
- [ok] `vitest run`: 11 arquivos, 48 testes passando (revisão: `campaigns.test.ts` removido; `calculations` mantido, cobre regras reais do `campaignSchema`); [ok] `npm run build`; [ok] `tsc --noEmit`: 0 erros.
- Os testes de Edge Function simulam `Deno` e `supabase-js`; não há Deno aqui para rodá-las de verdade.

## Branches
- PRs #1 a #28 mesclados (exceto #14, #15 e #19, fechados e substituídos). Branches mescladas podem ser apagadas no GitHub (limpeza opcional).
- Branches já mescladas e ainda existentes (local e remoto): `maintenance/2026-review`,
  `chore/claude-instructions`, `fix/update-last-live-authz`.

## Deploys
- [ok] Manual, 02/11: `collect-snapshots` e `consolidate-daily`.
- [ok] Workflow, merge do PR #4 (02/11): job concluiu com sucesso; `twitch-proxy` validado em produção.
- [a verificar] `update-last-live` em produção (função e `GRANT UPDATE` em `streamers`).
- [ok] Vercel (produção), merge do PR #7 (02/11): deploy concluído com sucesso.
- [ok] Vercel (produção), merge do PR #9 (02/11): deploy concluído com sucesso.
- [ok] Workflow, merge do PR #11 (02/11): `collect-snapshots` e `twitch-proxy` publicadas com sucesso.
- [ok] Vercel (produção), merge do PR #13 (02/11): deploy concluído; headers de segurança presentes.
- [ok] Vercel (produção), PRs #22 (CSP bloqueante), #24 (Node), #26–#28: deploys com sucesso (03/11). CSP confirmada via `curl`.
- [ok] Workflow de Edge Functions, PRs #23 (`consolidate-daily`) e #25 (`supabase-js` 2.118.0): sucesso; 4 funções respondem 401 sem credenciais.
- [ok] Banco (Dash Lugs), 03/11, com autorização: `is_allowed_user()` com `search_path` fixo, validado. Rollback fora do repositório.
