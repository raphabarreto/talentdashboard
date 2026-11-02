# AUDIT_STATUS — Talent Dashboard

Atualizado em 2026-11-02. Base: main @ 4e1ce5a. Sem segredos neste arquivo.
Legenda: [ok] confirmado no repo/testes · [usuário] informado pelo usuário · [a verificar]

## Concluído
- RLS por allowlist de e-mail (`is_allowed_user()`) nas tabelas: [usuário] aplicado em produção;
  [a verificar] via `pg_policies`. `schema.sql` e `docs/DATABASE.md` ainda mostram a policy antiga.
- CRON_SECRET fail-closed em `collect-snapshots` e `consolidate-daily` (PR #1): [ok] código na main;
  [ok] deploy manual (CLI 2.108.0, 02/11) e POST sem credenciais retornou 401 nas duas.
- `update-last-live` grava com o JWT do usuário (RLS), não service role (PR #3): [ok] na main.
  [a verificar] deploy em produção (workflow) e `GRANT UPDATE` de `authenticated` em `streamers`.
- Workflow de deploy: CLI fixada em 2.108.0 e `supabase` direto, sem `npx` (PR #1): [ok] código;
  [a verificar] resultado do job no GitHub Actions (gh não instalado aqui).
- CLAUDE.md criado (PR #2).
- `twitch-proxy`: exige `is_allowed_user()` via RPC com o JWT do usuário (403 se fora da allowlist) e
  encode/regex de `language`/`game_id`/`after`/`user_id`: [ok] código na working tree, testes 36/36 e
  `tsc` ok; **não commitado, sem deploy**. [a verificar] testar em produção após deploy.

## Pendente (por prioridade)
Média
1. XSS: 28 usos de `innerHTML` com dados sem escape; não há `escapeHtml` (`src/ui/table.ts`,
   `src/ui/prospecting.ts`, `src/ui/filters.ts`, `src/events/campaigns.ts`, outros em `src/ui`).
2. Dependências (`npm audit`: 1 crítica, 6 altas, 4 moderadas). Chegam ao navegador: `zod` <4.6.6 e
   `dompurify` (transitiva; [a verificar] via `npm ls dompurify`). O resto é dev/CI (vite, happy-dom,
   postcss, vitest...).
3. Falhas da Twitch não tratadas: sem `res.ok`/checagem do token em `collect-snapshots` e
   `twitch-proxy`; token ausente grava snapshots "offline" e distorce métricas.
4. Sem `vercel.json`, CSP nem headers de segurança (`index.html`/`login.html` sem CSP).
5. `is_allowed_user()` é `security definer` sem `set search_path` (`migration_rls_allowlist.sql`).
Baixa
7. `consolidate-daily` não checa o resultado dos `update` (rebaixado: o `delete` atinge só dados fora
   da janela das métricas).
8. CI em Node 20; sem `engines`/`.nvmrc`; local roda Node 26.
9. Imports `esm.sh` sem versão fixa (`supabase-js@2`) e Zod 3 nas functions vs Zod 4 no front.
10. `supabase/.temp/` versionado (10 arquivos); `deno.json` com imports não usados.
11. `schema.sql`/`docs/DATABASE.md`/migrations desatualizados e sem padrão de nome.
12. `twitchtracker.com` chamado direto do navegador (API não oficial, erro engolido).

## Tarefa atual
Nenhuma em andamento. Preparação concluída; aguardando instrução para retomar.

## Próximo passo sugerido
Item 1 (XSS: criar `escapeHtml` e aplicar nos `innerHTML`). Antes, commitar/PR do `twitch-proxy` se autorizado.

## Testes (local, main @ 4e1ce5a)
- [ok] `vitest run`: 7 arquivos, 36 testes passando. [ok] `tsc --noEmit`: 0 erros.
- [a verificar] build na main atual (passou na branch do PR #3); resultado do `test.yml` no CI.
- Os testes de Edge Function simulam `Deno` e `supabase-js`; não há Deno aqui para rodá-las de verdade.

## Branches
- Local `main` sincronizada com `origin/main`. PRs #1, #2 e #3 mesclados.
- Branches já mescladas e ainda existentes (local e remoto): `maintenance/2026-review`,
  `chore/claude-instructions`, `fix/update-last-live-authz`.

## Deploys
- [ok] Manual, 02/11: `collect-snapshots` e `consolidate-daily`.
- [a verificar] `twitch-proxy` e `update-last-live` (dependem do job disparado pelo merge).
