# Configurar Sentry (Monitoramento de Erros)

O Sentry já está integrado no código, mas **desabilitado até você adicionar a DSN**.

## Passos

### 1. Criar conta no Sentry

1. Acesse [sentry.io](https://sentry.io)
2. Crie uma conta gratuita (5.000 erros/mês)
3. Clique em **"Create Project"**
4. Escolha **"Browser"** como plataforma
5. Escolha **"JavaScript"** como framework
6. Dê um nome (ex: "talentdashboard")

### 2. Copiar a DSN

Após criar o projeto, você vai ver uma página com o código de integração. Copie apenas a **DSN** (algo como):

```
https://abc123def456@o789.ingest.sentry.io/1234567
```

### 3. Adicionar no .env

Edite seu arquivo `.env` e adicione:

```env
VITE_SENTRY_DSN=https://abc123def456@o789.ingest.sentry.io/1234567
```

### 4. Adicionar no Vercel

No Vercel (onde o front-end está hospedado):

1. Vá em **Settings → Environment Variables**
2. Adicione:
   - **Key:** `VITE_SENTRY_DSN`
   - **Value:** `https://abc123def456@o789.ingest.sentry.io/1234567`
3. Redeploy o projeto

### 5. Testar

Para testar se funciona, force um erro no console:

```javascript
throw new Error('Teste Sentry')
```

Depois de alguns segundos, o erro deve aparecer no dashboard do Sentry.

---

## Como funciona?

- **Desenvolvimento local:** Sentry desabilitado (erros só no console)
- **Produção (Vercel):** Sentry ativo, todos os erros são enviados automaticamente

### O que o Sentry captura?

✅ Erros JavaScript  
✅ Erros de validação (Zod)  
✅ Erros de requisições (Supabase)  
✅ Contexto completo (navegador, URL, usuário)  

### Dashboard

No Sentry você vai ver:
- Quantos erros aconteceram
- Quais são os mais frequentes
- Stack trace completo
- Navegador e sistema operacional do usuário

---

## Custo

**Plano gratuito:**
- 5.000 erros/mês
- 1 usuário
- 30 dias de histórico

Se ultrapassar, o Sentry apenas **para de capturar erros** até o mês seguinte. Não tem cobrança surpresa.

---

## Opcional

Por enquanto, se você não quiser configurar, **não precisa**. Os logs no console já funcionam. Mas quando tiver tempo, vale a pena adicionar!
