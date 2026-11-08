# Talent Dashboard

[![Tests](https://github.com/raphabarreto/talentdashboard/actions/workflows/test.yml/badge.svg)](https://github.com/raphabarreto/talentdashboard/actions/workflows/test.yml)

Dashboard para acompanhamento de streamers da Twitch. Monitora métricas como viewers, horas assistidas e horas transmitidas, com coleta automática de dados via Edge Functions.

## ✨ Features

- 📊 **Dashboard de Streamers**: Visualização em cards e tabelas
- 🔎 **Prospecção**: Busca de streamers por categoria na Twitch, com lista salva no banco
- 💰 **Gestão de Campanhas**: Comissão informada manualmente por campanha
- 📥 **Exportação CSV**: Exporte campanhas e streamers para planilhas
- 🔐 **Autenticação**: Google OAuth com emails permitidos
- 📈 **Coleta Automática**: Snapshots a cada 15 minutos (cron-job.org)
- 🔴 **Badge AO VIVO**: Indicador em tempo real de streamers online
- 🛡️ **Segurança**: Row Level Security no banco
- 📊 **Monitoramento**: Sentry integrado para erros em produção
- ✅ **Testes Automatizados**: Vitest, rodando no CI
- 🚀 **CI/CD**: GitHub Actions roda testes automaticamente
- 🔄 **Loading States**: Feedback visual durante operações
- ✏️ **Validação**: Zod para validação de dados consistente
- ⚡ **Performance**: Debounce, cache e queries otimizadas
- 📱 **PWA**: Instale como app nativo no desktop/mobile
- ⌨️ **Atalhos**: Ctrl+K para busca, Esc para fechar modais

## Stack

- **Front-end:** Vite + TypeScript + Tailwind CSS v4
- **Banco de dados e Auth:** Supabase (PostgreSQL + Google OAuth)
- **Hospedagem:** Vercel
- **Coleta de dados:** Supabase Edge Functions (Deno)
- **Cron:** cron-job.org (dispara as Edge Functions a cada 15 min)

## Estrutura

```
src/
  lib/
    supabase.ts       # Client Supabase
    auth.ts           # Autenticação (Google OAuth) e allowlist de e-mails
    data.ts           # Acesso ao banco (streamers, campanhas, lista da Prospecção)
    campaignSync.ts   # Diferença entre participantes salvos e novos (editar campanha sem apagar ninguém)
    registration.ts   # Regra única de cadastro de streamer (busca, lote, campanha)
    twitch.ts         # Twitch API (via Edge Function) e twitchtracker
    validators.ts     # Validação com Zod
    escape.ts         # escapeHtml (proteção contra XSS em innerHTML)
    logger.ts         # Logger centralizado
  events/
    campaigns/        # Eventos de campanhas (formulário, detalhes/status, interpretação do texto colado)
    streamers.ts      # Eventos de streamers (lote, remoção, PDF)
    streamers/
      lookup.ts       # Modal de busca/cadastro individual
    navigation.ts     # Eventos de navegação
  ui/
    overview.ts       # Visão Geral (cards)
    table.ts          # Tabela de streamers
    campaigns.ts      # Renderização de campanhas
    prospecting/      # Prospecção (busca por categoria, Minha Lista salva no banco)
    loadError.ts      # Aviso com "Tentar novamente" quando o carregamento inicial falha
    filters.ts        # Filtros com cache
  types/              # Interfaces TypeScript
  state.ts            # Estado global em memória
  constants.ts        # Constantes (paginação, prazos)
  utils.ts            # Formatação e helpers
  __tests__/          # Testes automatizados
  main.ts             # Lógica principal do dashboard
  login.ts            # Lógica da página de login
  style.css           # Tailwind import

public/               # favicon.png e manifest.json (PWA)
docs/                 # DATABASE.md e migrations-aplicadas/ (histórico já executado em produção)
supabase/functions/
  collect-snapshots/    # Coleta viewers a cada 15min
  consolidate-daily/    # Consolida métricas diárias (últimos 30 dias)
  twitch-proxy/         # Proxy autenticado para Twitch API
  update-last-live/     # Atualiza última vez online
```

## Configuração local

1. Clone o repositório
2. Copie `.env.example` para `.env` e preencha as variáveis
3. Instale as dependências e rode:

```bash
npm install
npm run dev
```

O servidor roda em `http://localhost:8000`.

## Scripts Disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run preview      # Preview do build
npm run test         # Roda testes (modo watch)
npm run test:ui      # Interface visual dos testes
npm run test:run     # Roda testes uma vez
npm run typecheck    # Confere os tipos (tsc --noEmit)
```

## Testes

O projeto possui testes automatizados (`npm run test:run`) que cobrem:
- ✅ Validação de dados (Zod schemas)
- ✅ Comissão informada manualmente (nunca calculada)
- ✅ Salvar/editar campanhas sem perda de participantes (inclui falhas simuladas do banco)
- ✅ Remoções e troca de status só aparecem como feitas quando o banco confirma
- ✅ Busca, ordenação e filtros
- ✅ Regras de negócio críticas (cadastro de streamer, lista da Prospecção, falhas da Twitch)
- ✅ Segurança (escape de HTML, allowlist de login, CSP)

Os testes e a checagem de tipos rodam automaticamente via GitHub Actions em todo push/PR. A publicação das Edge Functions só acontece depois que testes e tipos passam.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| VITE_SUPABASE_URL | URL do projeto Supabase |
| VITE_SUPABASE_ANON_KEY | Chave pública (anon) do Supabase |
| VITE_ALLOWED_EMAILS | Emails autorizados a logar (separados por vírgula) |
| VITE_SENTRY_DSN | DSN do Sentry para monitoramento de erros (opcional) |

As credenciais da Twitch (Client ID e Secret) ficam apenas nos secrets das Edge Functions no Supabase, sem exposição no front-end.

## Deploy

### Front-end (Vercel)
O deploy é automático — cada merge na `main` (sempre via Pull Request) gera um novo build.

URL de produção: https://dashlugs.vercel.app

### Edge Functions (Supabase)
Deploy automático via GitHub Actions quando houver mudanças em `supabase/functions/`.

**Configuração inicial (uma vez):**
1. Gerar Access Token no Supabase:
   - Acesse: https://supabase.com/dashboard/account/tokens
   - Clique em "Generate new token"
   - Copie o token

2. Pegar o Project ID:
   - Acesse seu projeto no Supabase
   - Settings → General → Project ID

3. Adicionar secrets no GitHub:
   - Vá em: Settings → Secrets and variables → Actions → New repository secret
   - Adicione:
     - `SUPABASE_ACCESS_TOKEN` = token gerado no passo 1
     - `SUPABASE_PROJECT_ID` = ID do passo 2

Após configurado, todo merge na `main` que modificar `supabase/functions/` vai deployar automaticamente.

## Banco de dados

O schema está em `schema.sql`. As tabelas principais são:

- `streamers` — cadastro de streamers monitorados
- `stream_snapshots` — coleta periódica de viewers/status
- `campaigns` e `campaign_streamers` — campanhas comerciais com streamers
- `streamer_history` — histórico diário consolidado
- `prospect_shortlist` — lista salva da aba Prospecção
- `allowed_users` — e-mails com acesso (usada pelas policies via `is_allowed_user()`)

## Documentação

- [`docs/DATABASE.md`](docs/DATABASE.md) - Schema do banco e explicação das tabelas
