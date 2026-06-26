# Melhorias Futuras

Lista de melhorias opcionais para implementar no futuro quando houver necessidade ou tempo disponível.

---

## 🔧 Infraestrutura

### 1. Backup Automático do Banco de Dados

**O que é:** Cópia de segurança automática dos dados do Supabase.

**Por que fazer:**
- Proteção contra perda acidental de dados
- Facilita migração futura
- Independência do backup do Supabase

**Como implementar:**
1. Criar script de backup com `pg_dump`
2. Agendar via cron (semanal)
3. Salvar backups no Google Drive ou S3

**Estimativa:** 30 minutos  
**Prioridade:** 🟡 Baixa

---

### 2. Healthcheck + UptimeRobot

**O que é:** Monitoramento de disponibilidade do sistema.

**Por que fazer:**
- Saber imediatamente se o site cair
- Email/SMS automático em caso de downtime
- Histórico de uptime

**Como implementar:**
1. Criar endpoint `/health` no projeto
2. Cadastrar no [UptimeRobot](https://uptimerobot.com) (grátis)
3. Configurar alertas por email

**Estimativa:** 20 minutos  
**Prioridade:** 🟡 Baixa

---

### 3. Alertas Proativos Avançados

**O que é:** Notificações automáticas de problemas.

**Por que fazer:**
- Detectar problemas antes de impactar o uso
- Resposta mais rápida a incidentes

**Exemplos:**
- Edge Function com taxa de erro > 10%
- Mais de 5 erros no Sentry em 1 hora
- Cron falhou 3x consecutivas

**Como implementar:**
1. Configurar Alerts no Sentry
2. Verificar notificações do cron-job.org
3. (Opcional) Integrar com Slack/Discord

**Estimativa:** 15 minutos  
**Prioridade:** 🟡 Baixa (cron-job.org já notifica)

---

## 📊 Analytics & Monitoramento

### 4. Analytics de Uso

**O que é:** Rastreamento de como o dashboard é usado.

**Por que fazer:**
- Entender padrões de uso
- Identificar features mais usadas
- (Só útil se tiver múltiplos usuários)

**Opções:**
- **Google Analytics:** Completo, mas invasivo
- **Plausible:** Simples e respeitoso (recomendado)

**Como implementar:**
1. Criar conta no Plausible
2. Adicionar script no `index.html`
3. Configurar eventos personalizados (opcional)

**Estimativa:** 10 minutos  
**Prioridade:** 🔴 Desnecessário (único usuário)

---

## 🚀 Automação & DevOps

### 5. Deploy Preview para Pull Requests

**O que é:** Preview automático de mudanças antes do merge.

**Por que fazer:**
- Testar mudanças em ambiente isolado
- Revisar visualmente antes de deployar
- (Vercel já faz isso automaticamente para PRs)

**Como melhorar:**
1. Configurar Vercel para criar preview em todo PR
2. Adicionar comentário automático no PR com link do preview

**Estimativa:** 10 minutos  
**Prioridade:** 🟡 Baixa (já funciona automaticamente)

---

### 6. Renovação Automática de Secrets

**O que é:** Rotação periódica de chaves de API.

**Por que fazer:**
- Melhor segurança
- Conformidade com boas práticas

**Como implementar:**
1. Script para renovar tokens da Twitch
2. Atualizar secrets do Supabase automaticamente
3. Agendar rotação mensal

**Estimativa:** 1 hora  
**Prioridade:** 🟡 Baixa (Twitch tokens não expiram)

---

## 📈 Performance & Otimização

### 7. Cache no Front-end

**O que é:** Armazenar campanhas/streamers no localStorage.

**Por que fazer:**
- Dashboard carrega instantaneamente
- Menos requisições ao Supabase
- Funciona offline (temporariamente)

**Como implementar:**
1. Salvar dados no localStorage ao carregar
2. Exibir cache enquanto busca dados atualizados
3. Sincronizar em background

**Estimativa:** 45 minutos  
**Prioridade:** 🟡 Baixa (carregamento já é rápido)

---

### 8. Imagens Otimizadas

**O que é:** Lazy loading e compressão de imagens.

**Por que fazer:**
- Carregamento mais rápido
- Menos consumo de banda

**Como implementar:**
1. Adicionar `loading="lazy"` nas imagens
2. Usar formato WebP
3. Implementar placeholders

**Estimativa:** 30 minutos  
**Prioridade:** 🔴 Desnecessário (poucas imagens)

---

## 🎨 UX & Features

### 9. Dark/Light Mode Toggle

**O que é:** Opção de alternar entre tema escuro e claro.

**Por que fazer:**
- Preferência pessoal do usuário
- Melhor visualização em diferentes ambientes

**Como implementar:**
1. Adicionar toggle no header
2. Salvar preferência no localStorage
3. Adicionar classes CSS para tema claro

**Estimativa:** 1 hora  
**Prioridade:** 🔴 Baixa (tema escuro já é bom)

---

### 10. Notificações Push

**O que é:** Notificar quando streamer específico ficar online.

**Por que fazer:**
- Acompanhar streamers favoritos
- Não perder lives importantes

**Como implementar:**
1. Usar Web Push API
2. Permitir marcar streamers como "favoritos"
3. Edge Function envia notificação quando favorito fica online

**Estimativa:** 2 horas  
**Prioridade:** 🟡 Média (feature legal!)

---

## 🔐 Segurança

### 11. Rate Limiting no Front-end

**O que é:** Limitar número de requisições por usuário.

**Por que fazer:**
- Prevenir abuso
- Proteger Edge Functions

**Como implementar:**
1. Usar middleware do Vercel
2. Limitar requisições por IP
3. Retornar 429 (Too Many Requests)

**Estimativa:** 30 minutos  
**Prioridade:** 🔴 Desnecessário (único usuário)

---

### 12. Auditoria de Acessos

**O que é:** Log de todos os acessos e ações no sistema.

**Por que fazer:**
- Rastrear atividades
- Detectar acessos suspeitos

**Como implementar:**
1. Criar tabela `audit_logs` no Supabase
2. Registrar login, logout, ações críticas
3. Dashboard de auditoria

**Estimativa:** 1 hora  
**Prioridade:** 🔴 Desnecessário (único usuário)

---

## 📝 Notas

- **Prioridade 🟢 Alta:** Fazer em breve
- **Prioridade 🟡 Média:** Fazer quando tiver tempo
- **Prioridade 🔴 Baixa:** Não fazer agora (pode nunca precisar)

---

**Última atualização:** 25/06/2026
