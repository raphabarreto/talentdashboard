# AUDIT_STATUS — Talent Dashboard

Atualizado em 2026-11-02. Base: main @ ca525cf. Sem segredos neste arquivo.
Legenda: [ok] confirmado no repo/testes · [usuário] informado pelo usuário · [a verificar]

## Concluído
- RLS por allowlist de e-mail (`is_allowed_user()`) nas tabelas: [usuário] aplicado em produção;
  [a verificar] via `pg_policies`. `schema.sql` e `docs/DATABASE.md` ainda mostram a policy antiga.
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
  (1 ano) e CSP em modo **Report-Only** (não bloqueia, só registra no console). `onclick` inline do menu do
  card (`src/ui/overview.ts`) trocado por listener. (PR #13) [ok] na main, testes 44/44, `tsc` e build; [ok] deploy Vercel de produção com sucesso e cabeçalhos confirmados via `curl` em produção (02/11).
  [a verificar] violações de CSP no console em produção e domínio do Sentry (`*.ingest.sentry.io` presumido);
  depois trocar para `Content-Security-Policy` (bloqueante) em PR separado.
- `twitch-proxy`: exige `is_allowed_user()` via RPC com o JWT do usuário (403 se fora da allowlist) e
  encode/regex de `language`/`game_id`/`after`/`user_id` (PR #4): [ok] na main, testes 36/36, build e
  `tsc` ok, job "Deploy Edge Functions" com sucesso (02/11). [usuário] `is_allowed_user()` executável por
  `authenticated` (true) e busca de streamers funcionando em produção. [a verificar] 403 com conta fora
  da allowlist (não testado).

## Pendente (por prioridade)
Média
1. `is_allowed_user()` é `security definer` sem `set search_path` (`migration_rls_allowlist.sql`).
Baixa
2. `consolidate-daily` não checa o resultado dos `update` (rebaixado: o `delete` atinge só dados fora
   da janela das métricas).
3. CI em Node 20; sem `engines`/`.nvmrc`; local roda Node 26.
4. Imports `esm.sh` sem versão fixa (`supabase-js@2`) e Zod 3 nas functions vs Zod 4 no front.
5. `supabase/.temp/` versionado (10 arquivos); `deno.json` com imports não usados.
6. `schema.sql`/`docs/DATABASE.md`/migrations desatualizados e sem padrão de nome.
7. `twitchtracker.com` chamado direto do navegador (API não oficial, erro engolido).

## Tarefa atual
Nenhuma em andamento. Aguardando: console do navegador em produção (violações de CSP) e autorização do PR de documentação.

## Próximo passo sugerido
Após aprovar e observar o console em produção: tornar a CSP bloqueante. Depois, item 1 (`set search_path` em `is_allowed_user()`; exige SQL no Supabase de produção, só com sua aprovação).

## Testes (main @ ca525cf)
- [ok] `vitest run`: 9 arquivos, 44 testes passando; [ok] `npm run build`; [ok] `tsc --noEmit`: 0 erros.
- Os testes de Edge Function simulam `Deno` e `supabase-js`; não há Deno aqui para rodá-las de verdade.

## Branches
- PRs #1 a #13 mesclados. `gh` instalado e autenticado.
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
