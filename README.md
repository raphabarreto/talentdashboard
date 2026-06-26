# Talent Dashboard

[![Tests](https://github.com/raphabarreto/talentdashboard/actions/workflows/test.yml/badge.svg)](https://github.com/raphabarreto/talentdashboard/actions/workflows/test.yml)

Dashboard para acompanhamento de streamers da Twitch. Monitora métricas como viewers, horas assistidas e horas transmitidas, com coleta automática de dados via Edge Functions.

## ✨ Features

- 📊 **Dashboard de Streamers**: Visualização em cards e tabelas
- 💰 **Gestão de Campanhas**: Cálculo automático de comissão (80/20)
- 📥 **Exportação CSV**: Exporte campanhas e streamers para planilhas
- 🔐 **Autenticação**: Google OAuth com emails permitidos
- 📈 **Coleta Automática**: Snapshots a cada 15 minutos
- 🔴 **Badge AO VIVO**: Indicador em tempo real de streamers online
- 🛡️ **Segurança**: Row Level Security no banco
- 📊 **Monitoramento**: Sentry integrado para erros em produção
- ✅ **Testes Automatizados**: 24 testes com Vitest
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
- **Cron:** cron-job.org (dispara Edge Functions a cada 5 min)

## Estrutura

```
src/
  lib/
    supabase.ts       # Client Supabase
    auth.ts           # Autenticação (Google OAuth)
    data.ts           # CRUD (streamers, campanhas)
    twitch.ts         # Twitch API
    validators.ts     # Validação com Zod
    logger.ts         # Logger centralizado
    export.ts         # Exportação CSV
  events/
    campaigns.ts      # Eventos de campanhas
    streamers.ts      # Eventos de streamers (modular)
    streamers/
      addStreamer.ts  # Modal de adicionar streamer
      lookup.ts       # Modal de lookup
    navigation.ts     # Eventos de navegação
  ui/
    campaigns.ts      # Renderização de campanhas
    overview.ts       # Renderização de cards
    table.ts          # Renderização de tabela
    filters.ts        # Filtros com cache
  __tests__/          # Testes automatizados
  types.ts            # Interfaces TypeScript
  main.ts             # Lógica principal do dashboard
  login.ts            # Lógica da página de login
  style.css           # Tailwind import

supabase/functions/
  collect-snapshots/    # Coleta viewers a cada 15min
  consolidate-monthly/  # Consolida métricas mensais
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
```

## Testes

O projeto possui 24 testes automatizados que cobrem:
- ✅ Validação de dados (Zod schemas)
- ✅ Cálculos de comissão (80/20)
- ✅ Debounce e cache de filtros
- ✅ Exportação CSV
- ✅ Regras de negócio críticas

Os testes rodam automaticamente via GitHub Actions em todo push/PR.

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| VITE_SUPABASE_URL | URL do projeto Supabase |
| VITE_SUPABASE_ANON_KEY | Chave pública (anon) do Supabase |
| VITE_ALLOWED_EMAILS | Emails autorizados a logar (separados por vírgula) |
| VITE_SENTRY_DSN | DSN do Sentry para monitoramento de erros (opcional) |

As credenciais da Twitch (Client ID e Secret) ficam apenas nos secrets das Edge Functions no Supabase, sem exposição no front-end.

## Deploy

O deploy é automático via Vercel — cada push no `main` gera um novo build.

URL de produção: https://dashlugs.vercel.app

## Banco de dados

O schema está em `schema.sql`. As tabelas principais são:

- `streamers` — cadastro de streamers monitorados
- `stream_snapshots` — coleta periódica de viewers/status
- `campaigns` — campanhas comerciais com streamers

## Documentação

- [`docs/SETUP.md`](docs/SETUP.md) - Guia completo de configuração do projeto
- [`docs/DATABASE.md`](docs/DATABASE.md) - Schema do banco e explicação das tabelas
- [`docs/SENTRY.md`](docs/SENTRY.md) - Configuração do Sentry para monitoramento
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) - Otimizações de performance aplicadas
- [`docs/MELHORIAS_FUTURAS.md`](docs/MELHORIAS_FUTURAS.md) - Roadmap de melhorias opcionais
