# Setup Local - Talent Dashboard

## Pré-requisitos

- Node.js 18+ e npm
- Conta no Supabase
- Conta no Twitch Developer (para Client ID e Secret)
- Conta no Google Cloud (para OAuth)

## 1. Clone e instale dependências

```bash
git clone <repo-url>
cd talentdashboard
npm install
```

## 2. Configure o Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com)
2. Vá em **SQL Editor** e execute o conteúdo de `schema.sql`
3. Copie a **URL** e **anon key** do projeto (Settings → API)

## 3. Configure OAuth do Google

1. Vá em [Google Cloud Console](https://console.cloud.google.com)
2. Crie um projeto novo
3. Vá em **APIs & Services → Credentials**
4. Crie uma **OAuth 2.0 Client ID** do tipo Web
5. Adicione os URIs:
   - Authorized JavaScript origins: `http://localhost:8000`, `https://seu-dominio.vercel.app`
   - Authorized redirect URIs: `https://seu-projeto.supabase.co/auth/v1/callback`
6. No Supabase, vá em **Authentication → Providers → Google**
7. Cole o **Client ID** e **Client Secret**

## 4. Configure variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
VITE_ALLOWED_EMAILS=seu-email@gmail.com,outro@gmail.com
```

## 5. Configure Twitch API (para Edge Functions)

1. Vá em [Twitch Developer Console](https://dev.twitch.tv/console)
2. Crie uma aplicação
3. Copie o **Client ID** e **Client Secret**
4. No Supabase, vá em **Edge Functions → Secrets**
5. Adicione:
   ```
   TWITCH_CLIENT_ID=seu-client-id
   TWITCH_CLIENT_SECRET=seu-secret
   ```

## 6. Deploy das Edge Functions

```bash
npx supabase login
npx supabase link --project-ref seu-projeto-ref
npx supabase functions deploy collect-snapshots --no-verify-jwt
npx supabase functions deploy consolidate-monthly --no-verify-jwt
npx supabase functions deploy twitch-proxy --no-verify-jwt
npx supabase functions deploy update-last-live --no-verify-jwt
```

## 7. Configure o Cron Job

1. Vá em [cron-job.org](https://cron-job.org)
2. Crie uma conta
3. Adicione um job:
   - **URL**: `https://seu-projeto.supabase.co/functions/v1/collect-snapshots`
   - **Intervalo**: A cada 5 minutos
   - **Headers**: `Authorization: Bearer sua-anon-key`

4. Adicione outro job para consolidação mensal:
   - **URL**: `https://seu-projeto.supabase.co/functions/v1/consolidate-monthly`
   - **Intervalo**: Todo dia 1º do mês às 3h
   - **Headers**: `Authorization: Bearer sua-anon-key`

## 8. Rode localmente

```bash
npm run dev
```

Acesse em `http://localhost:8000`

## 9. Deploy (Vercel)

```bash
npm run build
vercel --prod
```

Adicione as mesmas variáveis de ambiente no Vercel (Settings → Environment Variables).

## Troubleshooting

### "User not authorized" ao logar
- Verifique se seu email está em `VITE_ALLOWED_EMAILS`

### Edge Functions não funcionam
- Rode `npx supabase functions list` para ver se foram deployadas
- Confira se os secrets estão configurados no Supabase

### Erro de CORS na Twitch API
- Use a edge function `twitch-proxy` em vez de chamar direto
