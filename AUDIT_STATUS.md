# AUDIT_STATUS — Talent Dashboard

Atualizado em 2026-11-02. Base: main @ f581567. Sem segredos neste arquivo.
Legenda: [ok] confirmado no repo/testes · [usuário] informado pelo usuário · [a verificar]

## Concluído
- RLS por allowlist de e-mail (`is_allowed_user()`) nas tabelas: [usuário] aplicado em produção;
  [ok] confirmado via `pg_policies` em produção (03/11): 5 tabelas usam `is_allowed_user()`; `allowed_users` com RLS e 3
  e-mails. `schema.sql` e `docs/DATABASE.md` ainda mostram a policy antiga.
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
  maior), não aplicado. Não chegam ao navegador. (PR #9) [ok] na main; [ok] deploy Vercel de produção com sucesso (02/11). [a verificar] geração de PDF (`jspdf`/`dompurify`) no navegador.
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
- `twitch-proxy`: exige `is_allowed_user()` via RPC com o JWT do usuário (403 se fora da allowlist) e
  encode/regex de `language`/`game_id`/`after`/`user_id` (PR #4): [ok] na main, testes 36/36, build e
  `tsc` ok, job "Deploy Edge Functions" com sucesso (02/11). [usuário] `is_allowed_user()` executável por
  `authenticated` (true) e busca de streamers funcionando em produção. [a verificar] 403 com conta fora
  da allowlist (não testado).

## Pendente (por prioridade)
Baixa
1. Zod 3.23.8 nas functions vs Zod 4 no front (aceito: versões já fixas; unificar só se necessário).
2. `supabase/.temp/` versionado (10 arquivos); `deno.json` com imports não usados.
3. `schema.sql`/`docs/DATABASE.md`/migrations desatualizados e sem padrão de nome.
4. `twitchtracker.com` chamado direto do navegador (API não oficial, erro engolido).

## Tarefa atual
Pin do supabase-js em PR. Próximo: `supabase/.temp/` versionado e `deno.json` com imports não usados.

## Próximo passo sugerido
Após o PR #19: itens "Baixa" na ordem; `favicon.png` 404 (manifest aponta para /favicon.png, arquivo está em `src/`; só PWA). Alterações no Supabase de produção só com autorização explícita (CLI autenticado nesta máquina; usar `--remote=<ref>`, ref do Dash Lugs em `supabase/.temp/project-ref`).

## Testes (main @ f581567)
- [ok] `vitest run`: 9 arquivos, 41 testes passando (revisão: mantidos os de segurança e dados; `calculations` mantido, cobre regras reais do `campaignSchema`); [ok] `npm run build`; [ok] `tsc --noEmit`: 0 erros.
- Os testes de Edge Function simulam `Deno` e `supabase-js`; não há Deno aqui para rodá-las de verdade.

## Branches
- PRs #1 a #13, #16 a #18, #20 e #21 mesclados (#14 e #15 fechados, substituídos). `gh` instalado e autenticado.
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
