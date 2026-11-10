# AUDIT_STATUS — Talent Dashboard

Atualizado em 2026-11-09. Base: main @ bb408b7 (PR #106). Sem segredos neste arquivo.
Legenda: [ok] confirmado no repo/testes · [usuário] informado pelo usuário · [a verificar]

## Concluído
- RLS por allowlist de e-mail (`is_allowed_user()`) nas tabelas: [usuário] aplicado em produção;
  [ok] confirmado via `pg_policies` em produção (03/11): 5 tabelas usam `is_allowed_user()`; `allowed_users` com RLS e 3
  `schema.sql` e `docs/DATABASE.md` atualizados para refletir a produção (03/11) e a allowlist.
- CRON_SECRET fail-closed em `collect-snapshots` e `consolidate-daily` (PR #1): [ok] código na main;
  [ok] deploy manual (CLI 2.108.0, 02/11) e POST sem credenciais retornou 401 nas duas.
- `update-last-live` grava com o JWT do usuário (RLS), não service role (PR #3): [ok] na main.
  [usuário] funcionando em produção: streamer recém-cadastrado aparece como ativo (03/11), logo função e `GRANT UPDATE` ok.
- Workflow de deploy: CLI fixada em 2.108.0 e `supabase` direto, sem `npx` (PR #1): [ok] código;
  [ok] job no GitHub Actions com sucesso (merge do PR #4).
- CLAUDE.md criado (PR #2).
- XSS: `escapeHtml` (`src/lib/escape.ts`, com teste) aplicado nos campos de texto interpolados em
  `innerHTML` (`src/ui`, `src/events/campaigns.ts`) (PR #7): [ok] na main, testes, tsc e build; [ok] deploy Vercel de produção com sucesso (02/11).
  Não escapados: `id` (UUID do banco) e constantes. [ok] coberto por teste automatizado de renderização com nomes
  maliciosos (`xss-render.test.ts`, PR #64); `src/lib/logger.ts` usa só HTML estático.
- Dependências (`npm audit fix`, sem `--force`): `dompurify` 3.4.11→3.4.17, `zod` 4.4.3→4.6.7, `vite`,
  `postcss`, `nanoid`, `source-map-js` atualizados (só `package-lock.json`). [ok] testes 39/39, `tsc` e build.
  Restam 4 (3 moderadas, 1 alta), só dev: `vitest`/`@vitest/mocker`/`happy-dom`; exigem `--force` (versão
  maior), não aplicado. Não chegam ao navegador. (PR #9) [ok] na main; [ok] deploy Vercel de produção com sucesso (02/11). [usuário] geração de PDF funcionando em produção (03/11).
- Falhas da Twitch: `collect-snapshots` aborta sem gravar se token ou consulta falhar (antes gravava todos
  como "offline") e checa o resultado dos `insert`/`update`; `twitch-proxy` valida token e toda resposta da
  Twitch e responde 502 (antes devolvia lista vazia). [ok] testes 44/44 (5 novos), `tsc` e build.
  (PR #11) [ok] na main; [ok] job "Deploy Edge Functions" com sucesso (02/11). [usuário] busca de streamer e cadastro funcionando em produção (03/11). Efeito: em falha da Twitch o cron não grava aquela rodada (lacuna, não dado falso).
- Headers de segurança (`vercel.json`): nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS
  (1 ano) e CSP (Report-Only no PR #13; bloqueante no PR #22). `onclick` inline do menu do
  card (`src/ui/overview.ts`) trocado por listener. (PR #13) [ok] na main, testes 44/44, `tsc` e build; [ok] deploy
  Vercel de produção e cabeçalhos confirmados via `curl` (02/11). [usuário] console em produção mostrou 1
  violação: `unsafe-eval` (Zod testa `new Function`; tem fallback, não precisa liberar eval). Correção:
  `z.config({ jitless: true })` em `src/lib/validators.ts` + teste (PR #16) [ok] na main; [ok] deploy Vercel de produção com sucesso (03/11). [usuário] console sem violações de CSP (03/11).
  CSP bloqueante ativa desde o PR #22; domínio do Sentry (`*.sentry.io`) liberado e confirmado com evento real.
- `is_allowed_user()` com `search_path` fixado (`public, pg_temp`): [ok] executado em produção (Dash Lugs) em 03/11 com
  autorização; validado: `proconfig` ok, `authenticated` mantém EXECUTE, 5 policies intactas, allowlist com 3 e-mails.
  Rollback salvo fora do repositório. [usuário] conferir dashboard após a alteração.
- `consolidate-daily`: só apaga snapshots antigos se todos os updates deram certo; reporta falhas (500) e erro da
  limpeza; `cleaned` agora é verdadeiro de fato. [ok] testes 44/44 (3 novos), `tsc` e build. Reversão: revert do PR.
- Node: CI em Node 22 (antes 20), `.nvmrc` = 22 e `engines.node >=20` (PR de `chore/node-version`). Compatível com vite,
  vitest e happy-dom instalados. [ok] testes 44/44 e build local (Node 26); [ok] `test.yml` no CI com Node 22 passando em todos os PRs.
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

- Loop de login para e-mail fora da allowlist (login.html <-> home alternando): `getSession` agora desloga quem não está em `VITE_ALLOWED_EMAILS` (`src/lib/auth.ts`, + teste). Dados já eram bloqueados pelo banco; era só tela. [ok] testes 51/51, `tsc` e build. [usuário] testado em produção com e-mail fora da lista: não entra e fica no login, sem loop (03/11). Sem mensagem de erro, por decisão (uso individual). Reversão: revert do PR.

- Conferência de acesso (03/11, leitura apenas no Dash Lugs): corpo de `is_allowed_user()` compara `auth.jwt()->>email` com `allowed_users`; 5 policies usam a função; site de produção aponta para o projeto correto. Alarme falso: o e-mail testado estava na lista.

- Dependências seguras (só lock): `supabase-js` 2.108.2→2.118.0 (igual às functions), `@sentry/browser` 10.61.0→10.78.0, `jspdf-autotable` 5.0.8→5.0.9. [ok] testes 51/51, `tsc` e build. [usuário] login e PDF ok após o deploy (03/11); [ok] Sentry confirmado (evento real recebido). Reversão: revert do PR. Fora (salto de versão maior, só dev): vitest, vite, happy-dom, typescript.

- Prospecção: lista salva agora no banco (tabela `prospect_shortlist`, RLS `is_allowed_user()`), com `localStorage` como reserva e migração automática da lista antiga no primeiro acesso. Banco (Dash Lugs) alterado em 03/11 com autorização; validado: RLS ativa, policy e grants iguais a `streamers`. SQL em `docs/migrations-aplicadas/`. Rollback: `drop table public.prospect_shortlist;` + revert do PR. [ok] testes 54/54, `tsc`, build. [usuário] lista persiste (confirmado em 03/11). O nome da empresa continua só no navegador.

- Prospecção, autocompletar de categoria: cache também no navegador (7 dias), busca em andamento não é repetida, respostas antigas ignoradas, aviso "Buscando categorias..." e espera de 200 ms (antes 300). Só front; a chamada ao servidor/Twitch continua igual. [ok] testes 57/57, `tsc`, build. [a verificar] ganho percebido no uso real. Reversão: revert do PR.

- Refatoração do cadastro de streamer: regra única em `src/lib/registration.ts` (antes duplicada em modal de busca, lote e confirmação de campanha). Usa o id devolvido pelo insert (sem reconsultar por nome), consultas ao banco saíram dos eventos (`deleteStreamers` em `data.ts`) e a falha do cadastro automático na campanha agora avisa em vez de ser ignorada. [ok] testes 66/66 (9 novos), `tsc`, build. [usuário] modal de busca, lote e confirmação na campanha funcionando em produção (03/11). Reversão: revert do PR.

- Limpeza: removidos exports sem uso (`updateStreamer`, `logInfo`, `logWarn`, `PRODUCTION_URL`, `statusColors`, `selectColors`, `campaignStreamerSchema`); README (estrutura de pastas) e DATABASE.md atualizados; cron confirmado pelo usuário em 15 min; `CHANGELOG.md` removido (o histórico fica nos PRs). [ok] testes 66/66, `tsc`, build. Reversão: revert do PR.

- Sentry: DSN (região US) presente no site publicado e CSP libera `*.sentry.io`. `logger` agora envia o erro original (com stack) em vez de recriar só a mensagem. [ok] testes 70/70 (4 novos), `tsc`, build. [usuário] evento de teste chegou ao painel do Sentry em produção (03/11). Com bloqueador de anúncios ligado o envio é bloqueado pelo navegador (`ERR_BLOCKED_BY_CLIENT`); em janela sem extensão funciona. Reversão: revert do PR.

- Refatoração da Prospecção: `src/ui/prospecting.ts` (494 linhas, `setupProspecting` com 218) dividido em `src/ui/prospecting/` (categories, shortlist, email, layout, render, state, types, index). Código movido sem mudar comportamento (ids e classes do HTML conferidos idênticos); funções puras ganharam testes. [ok] testes 77/77, `tsc`, build. [usuário] Prospecção funcionando em produção (03/11). Reversão: revert do PR.

- Refatoração dos eventos de campanha: `src/events/campaigns.ts` (388 linhas, `setupCampaignsEvents` com 194) dividido em `src/events/campaigns/` (index, form, details, streamerAutocomplete, parse). Código movido sem mudar comportamento (ids e classes conferidos idênticos); `any` trocado por `ContactStatus`; conversões de valor e de linhas de streamers viraram funções puras com teste. [ok] testes 82/82, `tsc`, build. [usuário] campanhas funcionando em produção (03/11). Reversão: revert do PR.

- CSS externo com SRI: Font Awesome 6.5.2 e flag-icons 7.0.0 em `index.html` com `integrity` (sha384) e `crossorigin`; hashes calculados do arquivo entregue pela CDN (estável em 2 leituras) e CORS `*` confirmado. [ok] testes, `tsc`, build. [usuário] ícones e bandeiras ok em produção (03/11). Se sumirem: reverter o PR. Atualizar a versão exige recalcular o hash.

- Prospecção: removido o envio de e-mail (coluna Ações/botão Enviar, campo Empresa, modelos PT/ES, código que abria o Gmail e o teste). Mantidos a coluna Email e o filtro "Só com email". Nenhum outro modelo de texto no projeto (`streamerActionsTemplate` é só um bloco de botões escondido na aba Streamers). [ok] testes 79/79, `tsc`, build. Coluna `email` de `campaign_streamers` no banco não foi tocada. Reversão: revert do PR.

- Prospecção, Minha Lista: caixas de seleção por streamer (e "marcar todos") e botão "Copiar nomes selecionados" (um nome por linha, ordem da lista; formato aceito pela caixa Streamers das Campanhas, com teste). Ninguém é removido da lista ao copiar. O nome do streamer na Minha Lista agora abre a página Sobre do canal (`/about`); a tabela de resultados mantém o link do canal. Seleção só em memória. [ok] testes 82/82, `tsc`, build. [usuário] funcionando em produção (03/11). Reversão: revert do PR.

- Campanhas, campo Streamers: leitura inteligente do texto colado (`extractStreamerNames`, `src/events/campaigns/parse.ts`). Ignora bandeiras/emoji, países e rótulos (Brazil, Spain, Total, Aprovados…), marcadores, numeração, links da Twitch, valores e mensagens longas; remove duplicados (sem diferenciar maiúsculas); aceita nomes simples como antes. Linhas em dúvida abrem uma conferência (marcar, corrigir nome, "Confirmar e salvar" ou "Voltar e editar") antes de salvar. Nomes já conhecidos (campanha em edição e streamers do dashboard) são aceitos como estão. Status e acompanhamento das campanhas e a Prospecção não foram alterados. [ok] testes 94/94, `tsc`, build. [usuário] funcionou em produção com resposta real do Discord (03/11). Reversão: revert do PR.

- Campanhas, detalhes (olho): modal mais amplo (até `max-w-7xl`, 90% da altura), cabeçalho com resumo e filtros fixos e só a lista rolando; streamers em 1/2/3 colunas conforme a tela (muito mais nomes visíveis); chips mostram todas as etapas com a contagem (vazias apagadas) e "N no total"; bolinha de cor do status em cada linha; botões de ação mais enxutos (mesmas ações e mesmos `data-next`). Status, transições, busca, filtros e progresso preservados; sem mudança de banco, RLS, functions ou do formulário de edição. Obs.: não existe exclusão individual de streamer nesse modal (remover é pelo lápis, editando a lista). [ok] testes 98/98 (4 novos), `tsc`, build. [a verificar] visual no navegador (desktop e tela pequena). Reversão: revert do PR.

- Detalhes da campanha: altura do modal agora se adapta ao conteúdo (`max-h` 90% da tela, rolagem interna só quando necessário; cabeçalho, filtros, busca e Fechar preservados). Só classes no `index.html`. [ok] testes 98/98, `tsc`, build. [a verificar] visual no navegador. Reversão: revert do PR.

- Filtro de meses das Campanhas fora de ordem (Novembro antes de Abril): `.sort()` sem comparação ordenava números como texto; agora `.sort((a, b) => a - b)` em meses e anos (`src/ui/campaigns.ts`). Lógica de filtragem, mês/ano selecionados e visual inalterados; só existe esse filtro de meses no dashboard. Teste novo falha sem a correção. [ok] testes 101/101, `tsc`, build. Reversão: revert do PR.

## Pendente (por prioridade)
Baixa
1. [feito] Zod das functions unificado em 4.6.7 (PR #39; deploy de functions ok em 03/11; [usuário] cadastro de streamer ok em produção com Zod 4 (03/11)) (igual ao front). `deno.json` de `collect-snapshots` e `consolidate-daily` MANTIDOS: o `supabase/config.toml` os usa como `import_map` (remover quebrou o deploy; restaurados). [ok] testes 51/51, `tsc`, build. Reversão: revert do PR (redeploy automático).
3. Migrations: `migration_*.sql` da raiz movidos para `docs/migrations-aplicadas/` (histórico; fora de `supabase/migrations/` de propósito, para a CLI não reaplicar). Itens 1 e 2 feitos.

## Tarefa atual
Auditoria técnica CONCLUÍDA em 07/11/2026 e **em operação** (ver seção abaixo). Nenhuma correção em andamento. Último deploy de produção: PR #103 (merge `0b59147`).

## Feito em 03/11
- Teste de XSS automatizado (`src/__tests__/xss-render.test.ts`): nomes maliciosos em cards, tabela e campanhas não viram código. Corrigida a inicial do nome no card da Visão Geral, que não era escapada (PR #64).
- Prospecção: removidos "Copiar nomes selecionados" e as caixas de seleção da Minha Lista; "Copiar Lista" mantido (PR #66).
- Opcionais da auditoria encerrados (PR #65).

## Pendências (a verificar, sem urgência)
- [usuário] Usar o modal Gerenciar Campanha na OperaGX (45 streamers) em produção e avisar se algo ficar apertado/estranho (08/11: grupos por status, cartões compactos, "Marcar contato").
- Edge Functions: `supabase-js` fixado em 2.118.0 (esm.sh); atualizar só se houver motivo (deploy de produção). Versões grandes (vite 8, typescript 7, vitest 5, sentry 11): não mexer agora.
- Ambiente local limpo (08/11): servidor de teste desligado e `.env` removido. Para testar de novo: recriar `.env` com as 3 variáveis `VITE_*` públicas (extraídas do bundle de produção; as da Vercel são "sensíveis") e `npm run dev`.
- Usuário usa só PC: não listar conferências de celular.

## Próximo passo sugerido
1. Aguardar novos ajustes do usuário; revisão periódica com `npm audit`.
2. **[Implementado em 09/11: ver "Backup automático"; falta ativar o agendamento] Estratégia de backup do Supabase.** O projeto Dash Lugs não tem backup automático (sem PITR; lista de backups vazia em 07/11/2026). Opções a avaliar: plano com backups diários/PITR, ou rotina de exportação periódica (leitura) das tabelas `campaigns`, `campaign_streamers`, `streamers`, `prospect_shortlist` guardada fora do banco. Decidir com o usuário; exige conta/custo ou novo workflow.
3. Itens opcionais da auditoria (P3-06, P3-08, P3-09 e outros listados em "Riscos residuais") só se o usuário pedir.

## Feito em 07/11
- Ferramentas de teste (só dev): `vitest`/`@vitest/ui` 4.1.9→4.1.12 e `happy-dom` 20→21.0.4. `npm audit`: 0 vulnerabilidades (antes 4). Sem versão maior do vitest. [ok] testes 101/101, `tsc`, build. Reversão: revert do PR.
- Branches já mescladas apagadas (local e GitHub); fica só a `main`.
- Visão Geral (PR #69): selo "AO VIVO" ao lado do país (sem borda vermelha), aviso "últimos 30 dias", legendas legíveis ("Horas em live"), controles com 40 px e seta própria nos seletores (`.filter-select`). [usuário] aprovado no localhost; [ok] deploy de produção.
- Consultar Streamer + Minha Lista (PR #70): botão "+ Minha Lista (Prospecção)" no modal de consulta, gravando só 1 linha (`addProspectRow`, upsert; nunca regrava/apaga a lista) e faixa verde "Na sua Minha Lista · Ver lista". Botão "Consultar Streamer" (atalho `/`) acompanha a aba ativa (inclusive Campanhas e Prospecção). Filtro de país removido; busca "Buscar na lista..."; "+ Adicionar"; Sair só com ícone. [usuário] testado no localhost. [ok] testes 109/109, `tsc`, build. Reversão: revert do PR.
- Botões junto aos filtros em todas as abas (PR #71); Campanhas sem "Consultar Streamer". [usuário] aprovado no localhost.
- Prospecção (PR #72): busca alinhada, sem "Só com email" e sem "Consultar Streamer" (o campo "Adicionar pelo nome na Twitch" já faz isso); "Adicionar à Minha Lista (N)" sempre visível ao lado do contador (desativado sem seleção, sem deslocar a tela); Minha Lista sem rolagem interna; bandeiras com ícone e sigla do idioma do canal (ex.: EN) quando não é pt/es; "pt-br"/"es-es" tratados como pt/es. **"Limpar lista" agora pede confirmação** (antes apagava a lista inteira no banco com 1 clique). [usuário] aprovado no localhost. [ok] testes 114/114, `tsc`, build. Reversão: revert do PR.
- Prospecção, ajuste fino: "Limpar lista" junto dos outros controles da Minha Lista (continua discreto/vermelho e com confirmação); colunas com larguras definidas (Streamer 26%, Categoria 32%, Email, Ações centralizada) e textos longos cortados com reticências; contador "N streamers encontrados • X com email · de N lives carregadas" (o trecho final só quando a busca atinge o limite); tabela de resultados com as mesmas proporções da Minha Lista. Sem mudança na busca, filtros, Minha Lista ou "Copiar Lista". [ok] testes 116/116, `tsc`, build. [usuário] visual conferido em produção (07/11), exceto o alinhamento das tabelas (a verificar). Reversão: revert do PR.
- Tabela de Dados: colunas "Twitch" e "SullyGnome" unificadas em "Links" (ícone da Twitch e de gráfico, mesmas URLs e `target=_blank`, tooltips "Abrir Twitch"/"Abrir SullyGnome", `aria-label` com o nome do streamer, foco visível no teclado); estrutura Seleção | Nome | Média | Links | Ações com larguras fixas. Busca, filtros, paginação, seleção, PDF/CSV e remoção inalterados. [ok] testes 121/121 (5 novos), `tsc`, build. [a verificar] visual no navegador. Ordenar por "Nome do Streamer" não funcionava (`filters.ts` subtraía textos): corrigido depois (A→Z no 1º clique, sem diferenciar maiúsculas/acentos; `compareStreamers` + teste). Reversão: revert do PR.
- Tabela de Dados, ícones de Links: área clicável 36 px (`w-9 h-9 -my-1`, sem aumentar a linha) e espaço `gap-2`. Indicador ao vivo conferido: código igual ao anterior (vem de `is_live` do banco, atualizado pela coleta a cada 15 min; diferença entre abas é de momento de carregamento) + teste. Links: Twitch conferido via `curl` (título "Toniki - Twitch"); SullyGnome bloqueia acesso automatizado (403/Cloudflare), URL igual à anterior e coberta por teste. [ok] testes 123/123, `tsc`, build.
- Tabela de Dados: seta ▲/▼ no título da coluna ordenada ("Nome do Streamer" ou "Média de Viewers") e `aria-sort` para leitores de tela. [ok] testes 127/127, `tsc`, build. Reversão: revert do PR.
- Teste local: `.env` (ignorado pelo Git) com as 3 variáveis públicas `VITE_*`; as da Vercel são "sensíveis" e o `vercel env pull` não entrega o valor. CLI da Vercel instalada (logada durante a sessão; deslogada no fim, ver Pendências). Preview da Vercel fica preso no carregamento (variáveis só em produção).
- Banco (Dash Lugs), 07/11, com autorização: removida a coluna sem uso `campaign_streamers.email` (`alter table ... drop column email`). Antes: 194 linhas, todas vazias; sem views/funções/policies dependentes; front e Edge Functions não usavam. Validado: coluna ausente, 194 linhas, RLS ativa, 1 policy; consulta `campaigns?select=*,campaign_streamers(*)` responde 200. `schema.sql`, `DATABASE.md` e tipo `CampaignStreamer` atualizados; SQL e rollback em `docs/migrations-aplicadas/migration_drop_campaign_streamers_email.sql`. [usuário] campanhas funcionando em produção após a remoção (07/11).
- Sentry pelo próprio domínio: função `api/sentry-tunnel.ts` (Vercel) recebe os envelopes do navegador e repassa só para o projeto do DSN configurado no servidor (`SENTRY_DSN` ou `VITE_SENTRY_DSN`); destino montado a partir desse DSN; recusa outros (403), corpo > 1 MB (413), sem DSN (503). `Sentry.init({ tunnel })` em `main.ts`. CSP inalterada (`connect-src` já tem `self`; liberação de `*.sentry.io` mantida por enquanto). [ok] testes 135/135 (8 novos), `tsc` (src e api), build. [ok] produção (07/11): GET 405, envelope de outro destino 403, evento de teste do nosso projeto 200 ("Teste do túnel do Sentry (pode ignorar)"); site publicado usa o túnel. [usuário] evento real com bloqueador ligado chegou ao Sentry (08/11). Reversão: revert do PR.
- Tabela de Dados: "selecionar todos" marca/desmarca só a página atual (antes marcava todos os filtrados, ex.: "Remover (160)"); caixa do título reflete a página (marcada/"meio marcada"); 8 por página na Tabela (`TABLE_PAGE_SIZE`; Visão Geral segue com 12); exportação CSV removida (botão, `src/lib/export.ts` e teste), a pedido do usuário. PDF e Remover inalterados. [ok] testes 135/135, `tsc`, build. Reversão: revert do PR.
- Prospecção (08/11): rótulos pequenos sobre os campos removidos; texto de ajuda dentro dos campos ("Categoria (ex.: VALORANT)", "Viewers mín."); "Viewers mín." vazio usa 50 (`PROSPECT_DEFAULT_MIN_VIEWERS`), 0 é aceito. Autocompletar de categoria: espera 120 ms (antes 200) e mostra na hora categorias de buscas anteriores (cache 7 dias) até a Twitch responder. [ok] testes 135/135, `tsc`, build. [usuário] aprovado no localhost. Reversão: revert do PR.
- [usuário] Conferido em produção (08/11): Tabela de Dados (8 por página, selecionar todos só da página, sem CSV, ordenação por nome com seta, ícones Twitch/SullyGnome) e alinhamento das tabelas da Prospecção. [usuário] autocompletar de categoria da Prospecção "muito melhor" depois do PR #89 (120 ms + sugestões do cache) e do PR #90 (08/11); site funciona normal com bloqueador de anúncios (Sentry). Mobile fora do escopo (usuário usa só PC).
- `twitch-proxy` (08/11, autorizado pelo usuário): `getUser` e `is_allowed_user` agora rodam em paralelo (antes em fila), para encurtar cada busca (~0,1–0,2 s). Mesmas respostas: 401 token inválido, 403 fora da allowlist, ambos sem chamar a Twitch (2 testes novos). [ok] testes 137/137, `tsc`, build. [a verificar] efeito em produção após o deploy da Edge Function. Reversão: revert do PR (redeploy automático).
- Confirmações de remoção/exclusão (PR #91 e ajuste de botões, 08/11): janela única `confirmAction` redesenhada (título + descrição com nomes reais, Cancelar neutro, ação vermelha; Sair em azul), foco em Cancelar, Esc/clique fora cancelam, foco preso e devolvido, texto via `textContent`; botões centralizados e de mesma largura. Lógica de exclusão, Supabase e RLS intactos; nenhuma confirmação criada/removida. [ok] testes, `tsc`, build. [usuário] aprovado no localhost. Reversão: revert do PR.
- Visão Geral, modo de seleção (08/11): botão "Selecionar" → caixas no cabeçalho dos cards, clicar no card marca/desmarca (fora de links/menus/caixa), borda roxa, barra compacta acima dos cards (N selecionado(s), Selecionar esta página, Limpar seleção, Remover (N) desativado sem seleção), "Sair da seleção" limpa tudo. Remoção em massa usa a mesma confirmação e `removeSelected` (mesma lógica da Tabela de Dados; seleção compartilhada). Corrigida grade de cards duplicada no HTML durante o desenvolvimento. [ok] testes 151/151, `tsc`, build. [usuário] aprovado no localhost. Reversão: revert do PR.

- CSP (08/11, autorizado): removidos `https://*.ingest.sentry.io` e `https://*.sentry.io` do `connect-src` (o navegador só fala com o próprio domínio; o Sentry vai pelo túnel `/api/sentry-tunnel`). [ok] testes, `tsc`, build. [a verificar] após o deploy: reenviar um erro pelo console e ver chegar ao Sentry. Reversão: revert do PR (devolve os dois domínios).
- [usuário] Detalhes da campanha (ícone do olho) conferidos em tela de PC: tudo ok (08/11).
- Aba Campanhas (08/11, aprovado pelo usuário no localhost, só apresentação; sem mudança em dados, financeiro ou Supabase):
  - Tabela em 5 colunas: Empresa | Período (sem ano; mantém anos se atravessar anos) | Meu Valor (com "Pagamento: dd/mm" e "Não lançado") | Streamers | Ações (botão "Gerenciar", lápis, menu ⋮ com "Excluir campanha" e confirmação). Cada campanha segue sendo um contrato independente (sem agrupar). Ordem: início mais recente primeiro, com desempate fixo por criação (`getCampaigns`, só leitura).
  - Formulário: rótulo "Empresa" acima do campo.
  - Modal "Gerenciar Campanha": coluna única (cabeçalho com X, card único "Resumo da campanha", seção Streamers com badge de total, Fechar). Até 5 streamers: lista direta com status abaixo do nome, sem busca; 6+: busca + grupos por status recolhidos (Contatados, Pendentes, Sem resposta, Confirmados, Recusados; vazios ocultos; busca abre os grupos com resultado), sem filtros horizontais; lista com altura máx. ~380 px e rolagem interna. Botão "Marcar contato" (ação para pendente → contatado, mesma transição), "Reverter status" com tooltip. Valor em dólar exibido com vírgula. Regras de status e Recusado inalterados.
  - [ok] testes 180/180, `tsc`, build. [a verificar] em produção: uso real do modal com a OperaGX (45 streamers). Reversão: revert do PR.
- Modal Gerenciar Campanha, cartões compactos nos grupos (08/11, aprovado no localhost): avatar 32 px, menos padding e espaço (só com 6+ streamers; lista direta inalterada). Só apresentação. [ok] testes 181/181, `tsc`, build. Reversão: revert do PR.- Dependências de rotina (08/11, autorizado): `@supabase/supabase-js` 2.118→2.119.0 (só o front; as Edge Functions seguem fixadas em 2.118.0 no esm.sh), `tailwindcss` e `@tailwindcss/postcss` 4.3.4→4.3.5 (só `package.json`/lock). [ok] testes 181/181, `tsc`, build, `npm audit` 0. Reversão: revert do PR.
- [usuário] Sentry: itens de teste resolvidos (08/11). Usuário pediu para não tratar mais de Supabase CLI/logout.

- [usuário] Teste de 403 (conta fora da allowlist) funcionando em produção (08/11); fecha o item [a verificar] do `twitch-proxy`. Usuário informou "tudo certo" nas conferências restantes.

## Auditoria técnica — CONCLUÍDA em 07/11/2026 (em operação)
Resultado: 0 problemas P0; 1 P1, 5 P2 e 9 P3 identificados; os confirmados foram corrigidos e publicados. PR #103 mesclado (merge commit `0b59147`, merge commit, não squash).
- [ok] P1-01/P2-01: campanha salva por diferença (`lib/campaignSync.ts` + `data.ts`); quem continua na lista nunca é apagado e recriado; todo erro interrompe e é mostrado; repetir o salvamento não duplica; criação desfaz a campanha se os streamers falharem. Remover participantes pede confirmação.
- [ok] P2-02: remoção de streamer/campanha só aparece depois do banco confirmar ("Removendo..." + bloqueio de clique duplo). Troca de status volta ao valor real se falhar. Cadastro automático ao confirmar atualiza as outras abas.
- [ok] P2-03: falha no carregamento inicial mostra aviso com "Tentar novamente".
- [ok] Minha Lista (Prospecção): gravação por item (antes regravava a lista inteira); app não quebra com armazenamento do navegador bloqueado.
- [ok] Edge Functions: 500 genérico em `twitch-proxy`/`update-last-live`; limite de 100 nomes por consulta.
- [ok] CI: tipos no `test.yml`, job `audit` (não bloqueante), deploy das funções só após tipos+testes, permissões mínimas e fila única.
- [ok] Validação final: 242 testes (eram 181), `tsc` 0 erros, build ok, `npm audit` 0.
- [ok] Publicação: Vercel concluído; GitHub Actions "Deploy Edge Functions" (verify + deploy) com sucesso, 4 funções republicadas; as 4 respondem 401 sem credenciais; cabeçalhos de segurança presentes.
- [usuário] Testes manuais em produção aprovados (campanhas, streamers, remoção, Prospecção).
- [ok] Proteção da `main` ativada: PR obrigatório, check `test` obrigatório, branch atualizada, sem push direto/force-push, sem exigir revisor; vale também para o administrador.
- [ok] Índice único aplicado em produção (Dash Lugs, com autorização, 07/11): `campaign_streamers_campaign_name_unique` em `(campaign_id, lower(trim(streamer_name)))`. Antes: 193 linhas, 0 duplicatas, 0 nomes vazios/sem campanha, índice inexistente. Depois: índice válido e ativo, 0 duplicatas, 193 linhas com hash idêntico ao de antes (dados intactos); 31 nomes continuam em mais de uma campanha (mesmo streamer em campanhas diferentes segue permitido). Arquivo movido para `docs/migrations-aplicadas/`. Rollback: `drop index if exists campaign_streamers_campaign_name_unique;`.

### Riscos residuais conhecidos (sem ocultar)
- Salvar campanha NÃO é uma transação única: se a lista de participantes falhar na edição, os dados da campanha podem já ter sido gravados (a janela fica aberta com erro; repetir é seguro). A atomicidade estrita exigiria uma função no banco (RPC), não implementada por não haver perda silenciosa.
- Duas abas editando a mesma campanha: o índice único impede nome duplicado (a segunda gravação recebe erro genérico "Erro ao salvar campanha"; repetir resolve). Cada gravação é "último a gravar vence" por item.
- O índice usa `trim()` do Postgres (só espaços); o app usa o `trim()` do JavaScript (também tabs/espaços especiais). Nomes que diferem só por tab/espaço especial não são bloqueados pelo banco; efeito prático desprezível.
- Supabase sem backup automático (sem PITR; lista de backups vazia): não há recuperação de dados pelo painel. Foi feita cópia local (somente leitura) da tabela antes do índice; considerar rotina de exportação ou plano com backup. Atualização (09/11): backup manual criptografado criado e recuperação validada (ver "Backup automático"); falta ativar o agendamento. [a verificar]
- Edge Functions de cron (`collect-snapshots`, `consolidate-daily`) ainda devolvem o texto do erro (exigem o segredo; decisão consciente, útil para diagnóstico).
- Não feitos de propósito: P3-06 (Esc fecha formulário preenchido), P3-08 (lotes de 10 no `collect-snapshots`, sem lentidão medida), P3-09 (nome do pacote), lint (exigiria dependência nova). Latência da remoção em cascata no servidor não medida.
- Actions pinadas por tag (`@v4`), não por hash; avisos de descontinuação do Node 20 nas Actions (sem impacto hoje).

## Backup automático (PR #105 na main; execução manual validada; agendamento DESLIGADO)
- Implementado em `scripts/backup/` + workflows `backup.yml` (só manual; agendamento comentado) e `backup-selftest.yml` (dados fictícios no CI). Documentação: `docs/BACKUP.md`.
- [ok] Configuração (09/11, com autorização): token Supabase só `Database → Read`, restrito ao projeto Dash Lugs, testado localmente (8 OK, 0 excesso) e cadastrado como secret `SUPABASE_BACKUP_TOKEN` somente no ambiente `backup` (restrito à `main`; sem secret equivalente no repositório); variável de repositório `BACKUP_GPG_PUBLIC_KEY` (só a chave pública; fingerprint conferida) e variável do ambiente `SUPABASE_PROJECT_REF`. Chave privada nunca esteve no GitHub.
- [ok] 1ª execução real (09/11, run 42637202782, `main`, sem `force`): todas as etapas com sucesso (leitura das 6 tabelas, validação, teste de restauração, criptografia, upload e conferência). Artifact `backup-2026-11-09` (21.543 bytes, retenção 30 dias, expira 09/12/2026). Linhas: campaigns 20, streamers 166, allowed_users 3, streamer_history 0, campaign_streamers 193, prospect_shortlist 13 (395 no total).
- [usuário] Recuperação validada localmente (09/11) com a chave privada, sem rede nem banco: SHA-256 e tamanho conforme o manifesto, destinatários, descriptografia, JSON/estrutura/relacionamentos e contagens das 6 tabelas (0 erros, 0 avisos), limpeza dos temporários. Obs. técnica: o GPG do Git, chamado do PowerShell, só inicia o keyboxd com `C:\Program Files\Git\usr\bin` no PATH do processo (sem isso: DLL não encontrada).
- Pendente de autorização do dono: ativar o agendamento (06h e 18h Brasília; descomentar o bloco `schedule` de `backup.yml`, em PR próprio). Até lá o backup é só manual. [a verificar] execução agendada; [a verificar] restauração real em outro projeto (o teste cobriu o arquivo, não um restore no Supabase).
- Limitações registradas: agendamento desativa após 60 dias sem atividade (sem commits artificiais, por decisão); artifacts ficam no GitHub (ponto único de falha); chave privada é insubstituível.
- [ok] Deduplicação testada (09/11, run 42655934118, `main`, sem `force`): o job `backup` foi ignorado e nenhum novo artifact foi criado.
- **Achado (09/11): repositório público = artifacts e logs baixáveis por qualquer conta GitHub logada.** Conteúdo está criptografado (só a chave privada abre), mas o dono NÃO aceitou formalmente esse risco. Decisão: não ativar o agendamento enquanto os backups estiverem como artifacts públicos. Não tornar o repositório principal privado (GitHub Free: ambientes só em repositório público).
- **Migração concluída em 10/11 (ver bloco acima). Histórico da Opção A, aprovada:** backups criptografados como GitHub Releases em repositório PRIVADO separado, `talentdashboard-backups` (tag `backup-AAAA-MM-DD`, arquivos `.json.gpg` + `manifest.json`; rascunho → upload → conferência → publicação), retenção 90 dias (começa só em dry-run), job único (sujeito à revisão do PR), gravação dupla só em transição curta.
  - [ok] Fase 0 parcial (09/11): repositório criado PRIVADO, Actions desabilitado, sem colaboradores, issues/wiki/projects desligados, **releases imutáveis ativadas** (confirmado pela API; vale só para releases futuras). Branch padrão `master` (renomear para `main` é decisão aberta). 0 releases, nenhum token/secret criado.
  - **Plano simplificado (10/11, aprovado):** em vez de gravação dupla/importação manual/retenção, um único PR (`feat/backup-releases-privadas`): `publish-release.mjs` (valida repositório privado e escrita, rascunho → envio → baixa de volta e compara hash → publica), `check-existing.mjs` e `evaluateCandidate` olhando a Release do dia, sem `upload-artifact`/`verify-upload`, `GITHUB_TOKEN` só `contents: read`. PR #108 (workflow temporário de teste) fechado sem merge. Testes com API simulada. [a verificar] primeiro backup real na Release e recuperação a partir dela; depois, PR separado do agendamento. O artifact público de 09/11 expira em 09/12.
  - (Plano anterior, substituído) Próximos passos, cada um com autorização própria: (1) dono cria token fine-grained só no repositório `talentdashboard-backups` com `Contents: Read and write` (validade 1 ano) e cadastra como `BACKUPS_REPO_TOKEN` só no ambiente `backup`; (2) teste local do token (script fora do projeto, sem imprimir token; cobrir upload de asset e exclusão de release de teste); (3) importar manualmente `backup-2026-11-09` como release e rodar a recuperação a partir dela; (4) PR de gravação dupla; (5) PR de corte (remove `upload-artifact`/`verify-upload`, teste de CI contra `upload-artifact`, `GITHUB_TOKEN` só `contents: read`, reescrever procedência em `check-existing.mjs` para releases, limpeza de retenção em dry-run); excluir o artifact público só com autorização; (6) PR separado para ativar o agendamento.
  - Estado ao encerrar a sessão (09/11): agendamento DESLIGADO; nenhum backup novo; artifact `backup-2026-11-09` continua disponível (expira 09/12/2026, antes disso o backup precisa existir também na release privada).

- **Backup em Releases privadas: implementado e validado (10/11).** PR #109 na main (merge `8a53879`; exige `immutable === true`, só apaga rascunhos comprovadamente nossos). [ok] 1ª execução real (run 42890001041, `main`, sem `force`): leitura das 6 tabelas, validação, teste de restauração, criptografia, publicação e conferência por download; Release `backup-2026-11-10` publicada, `immutable: true`, 2 arquivos (.json.gpg 20.618 bytes + manifest.json 631 bytes), 395 linhas (campaigns 20, streamers 166, allowed_users 3, streamer_history 0, campaign_streamers 193, prospect_shortlist 13). Tokens mascarados nos logs. [ok] 2ª execução (run 42890243157, sem `force`): job `check` achou o backup íntegro e o job `backup` foi ignorado; continua 1 só Release. [usuário] Recuperação local validada a partir da Release (10/11): SHA-256 correto, descriptografia GPG, estrutura válida, 395 registros, 0 erros, limpeza confirmada.
- [ok] Artifact público `backup-2026-11-09` (id 13683106962, run 42637202782) excluído em 10/11 com autorização; antes era o único artifact do repositório (agora 0). Release privada de 10/11 conferida intacta (publicada, imutável, mesmos hashes). Não há mais cópia de backup em repositório público.
- **Pendente (autorização própria):** ativar o agendamento (06h e 18h de Brasília) em PR separado. [a verificar] execução agendada; [a verificar] restauração real em outro projeto (testes cobrem o arquivo, não um restore no Supabase). Sem retenção automática (cada backup ~21 KB). Chave privada é insubstituível.

## Testes (07/11)
- [ok] `vitest run`: 28 arquivos, 135 testes passando; [ok] `npm run build`; [ok] `tsc --noEmit`: 0 erros.
- Os testes de Edge Function simulam `Deno` e `supabase-js`; não há Deno aqui para rodá-las de verdade.

## Branches
- PRs #1 a #67 mesclados (exceto #14, #15 e #19, fechados e substituídos). Branches mescladas apagadas em 07/11.

## Deploys
- [ok] Manual, 02/11: `collect-snapshots` e `consolidate-daily`.
- [ok] Workflow, merge do PR #4 (02/11): job concluiu com sucesso; `twitch-proxy` validado em produção.
- [ok] `update-last-live` em produção confirmado pelo usuário (03/11).
- [ok] Vercel (produção), merge do PR #7 (02/11): deploy concluído com sucesso.
- [ok] Vercel (produção), merge do PR #9 (02/11): deploy concluído com sucesso.
- [ok] Workflow, merge do PR #11 (02/11): `collect-snapshots` e `twitch-proxy` publicadas com sucesso.
- [ok] Vercel (produção), merge do PR #13 (02/11): deploy concluído; headers de segurança presentes.
- [ok] Vercel (produção), PRs #22 (CSP bloqueante), #24 (Node), #26–#28: deploys com sucesso (03/11). CSP confirmada via `curl`.
- [ok] Workflow de Edge Functions, PRs #23 (`consolidate-daily`) e #25 (`supabase-js` 2.118.0): sucesso; 4 funções respondem 401 sem credenciais.
- [ok] Banco (Dash Lugs), 03/11, com autorização: `is_allowed_user()` com `search_path` fixo, validado. Rollback fora do repositório.
- [ok] Banco (Dash Lugs), 07/11, com autorização: `drop column campaign_streamers.email`, validado.
