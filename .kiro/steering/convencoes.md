# Talent Dashboard v2 - Convenções

## Stack

- Front-end: Vite + TypeScript + Tailwind CSS v4 (vanilla, sem framework)
- Banco + Auth: Supabase (PostgreSQL + Auth com Google OAuth)
- Edge Functions: Deno/TypeScript (Supabase Edge Functions)
- Hospedagem front-end: Vercel (quando for deploy)
- Cron: cron-job.org (dispara Edge Functions)

## Estrutura

```
src/
├── lib/
│   ├── supabase.ts    # Client Supabase
│   ├── auth.ts        # Autenticação (Google OAuth)
│   ├── data.ts        # CRUD (streamers, campanhas)
│   └── twitch.ts      # Twitch API
├── types.ts           # Interfaces TypeScript
├── main.ts            # Lógica principal do dashboard
├── login.ts           # Lógica da página de login
└── style.css          # Tailwind import

supabase/functions/
├── collect-snapshots/ # Coleta viewers a cada 5min
└── consolidate-monthly/ # Consolida métricas mensais
```

## Variáveis de ambiente (.env)

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_TWITCH_CLIENT_ID
- VITE_TWITCH_CLIENT_SECRET
- VITE_ALLOWED_EMAILS

## Regras

- Nenhum dado sensível em hardcode
- Usar modal customizado em vez de `confirm()` / `alert()`
- Commits em português
- Não fazer push/deploy sem autorização explícita do usuário



## Ideias pendentes

### Opção C - Pagamentos simplificados (se opção A não agradar)
- Um campo "valor total recebido" na campanha (quanto a empresa pagou)
- Pagamentos individuais aos streamers separados do valor da campanha
- Comissão calculada: total recebido - soma dos pagamentos feitos
