# Talent Dashboard

Dashboard para acompanhamento de streamers da Twitch. Monitora métricas como viewers, horas assistidas e horas transmitidas, com coleta automática de dados via Edge Functions.

## ✨ Features

- 📊 **Dashboard de Streamers**: Visualização em cards e tabelas
- 💰 **Gestão de Campanhas**: Cálculo automático de comissão (80/20)
- 📥 **Exportação CSV**: Exporte campanhas para planilhas
- 🔐 **Autenticação**: Google OAuth com emails permitidos
- 📈 **Coleta Automática**: Snapshots a cada 5 minutos
- 🛡️ **Segurança**: Row Level Security no banco
- 📊 **Monitoramento**: Sentry integrado para erros
- ✅ **Testes Automatizados**: Vitest para validações e cálculos

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
    supabase.ts    # Client Supabase
    auth.ts        # Autenticação (Google OAuth)
    data.ts        # CRUD (streamers, campanhas)
    twitch.ts      # Twitch API
  types.ts         # Interfaces TypeScript
  main.ts          # Lógica principal do dashboard
  login.ts         # Lógica da página de login
  style.css        # Tailwind import

supabase/functions/
  collect-snapshots/    # Coleta viewers a cada 5min
  consolidate-monthly/  # Consolida métricas mensais
  twitch-proxy/         # Proxy autenticado para Twitch API
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

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| VITE_SUPABASE_URL | URL do projeto Supabase |
| VITE_SUPABASE_ANON_KEY | Chave pública (anon) do Supabase |
| VITE_ALLOWED_EMAILS | Emails autorizados a logar (separados por vírgula) |

As credenciais da Twitch (Client ID e Secret) ficam apenas nos secrets das Edge Functions no Supabase, sem exposição no front-end.

## Deploy

O deploy é automático via Vercel — cada push no `main` gera um novo build.

URL de produção: https://dashlugs.vercel.app

## Banco de dados

O schema está em `schema.sql`. As tabelas principais são:

- `streamers` — cadastro de streamers monitorados
- `stream_snapshots` — coleta periódica de viewers/status
- `campaigns` — campanhas comerciais com streamers
