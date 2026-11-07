# Database Schema - Talent Dashboard

> Conferido contra o banco de produção em 2026-11-03. O arquivo `schema.sql` espelha este estado.

## Tabelas

### `streamers`
Armazena os streamers monitorados.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Primary key |
| `name` | text | Nome do streamer na Twitch |
| `country` | text | País (código ISO) |
| `avg_viewers` | int | Média de viewers (atualizada via snapshots) |
| `peak_viewers` | int | Pico de viewers |
| `hours_watched` | int | Total de horas assistidas |
| `hours_streamed` | int | Total de horas transmitidas |
| `game_name` | text | Último jogo/categoria conhecido |
| `main_category` | text | Categoria principal do streamer (coluna legada, sem uso na UI atual) |
| `last_live_at` | timestamptz | Última vez que ficou online |
| `created_at` | timestamptz | Data de criação |

---

### `stream_snapshots`
Coleta periódica de viewers (a cada 15 minutos via Edge Function, disparada pelo cron-job.org).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Primary key |
| `streamer_id` | uuid | FK para `streamers.id` |
| `viewers` | int | Número de viewers no momento |
| `is_live` | boolean | Se estava ao vivo |
| `game` | text | Categoria/jogo transmitido |
| `captured_at` | timestamptz | Momento da coleta |

**Índices:**
- `idx_snapshots_streamer_captured` em `(streamer_id, captured_at)`
- `idx_snapshots_live` em `(is_live, captured_at)`

**Limpeza automática:** Snapshots > 6 meses são deletados (via pg_cron).

---

### `streamer_history`
Histórico mensal consolidado (gerado pela Edge Function `consolidate-daily`).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Primary key |
| `streamer_id` | uuid | FK para `streamers.id` |
| `month` | text | Formato `2026-06` |
| `avg_viewers` | int | Média de viewers no mês |
| `peak_viewers` | int | Pico no mês |
| `hours_watched` | int | Horas assistidas no mês |
| `hours_streamed` | int | Horas transmitidas no mês |
| `created_at` | timestamptz | Data de criação |

**Constraint:** `unique(streamer_id, month)`

---

### `prospect_shortlist`
Lista salva da aba Prospecção (antes ficava só no navegador).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `user_login` | text | Primary key (login da Twitch) |
| `data` | jsonb | Dados do streamer na lista (nome, jogo, idioma, e-mail, `added_at`) |
| `created_at` | timestamptz | Data de criação |

---

### `campaigns`
Campanhas comerciais com empresas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Primary key |
| `company` | text | Nome da empresa/marca |
| `start_date` | date | Data de início |
| `end_date` | date | Data de fim |
| `total_received` | numeric(12,2) | Valor recebido |
| `campaign_value` | numeric | Valor da campanha (padrão 0) |
| `original_amount_usd` | numeric | Valor original em USD (quando aplicável) |
| `my_commission` | numeric | Comissão informada manualmente |
| `currency` | text | Moeda (`BRL` ou `USD`; validado no front, sem CHECK no banco) |
| `commission_percentage` | integer | Percentual de comissão (deprecated, padrão 20) |
| `payment_date` | date | Data que você recebeu o pagamento |
| `created_at` | timestamptz | Data de criação |

**Comissão:** informada manualmente no campo `my_commission` (não é mais calculada automaticamente).

---

### `campaign_streamers`
Streamers associados a cada campanha.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Primary key |
| `campaign_id` | uuid | FK para `campaigns.id` |
| `streamer_name` | text | Nome do streamer |
| `payment` | numeric(10,2) | Valor pago ao streamer (opcional) |
| `payment_date` | date | Data do pagamento ao streamer |
| `contact_status` | text | Status: `pendente`, `contatado`, `nao_respondeu`, `confirmado`, `recusado` |

**Auto-registro:** Quando um streamer é marcado como `confirmado`, ele é automaticamente adicionado à tabela `streamers` (se ainda não existir).

---

## Allowlist e Row Level Security (RLS)

Todas as tabelas têm RLS habilitado. O acesso é restrito aos e-mails da tabela `allowed_users`
(sem policies: não é acessível pela API) por meio da função `is_allowed_user()`:

```sql
-- security definer com search_path fixo (public, pg_temp)
create policy "Allow all for allowed users"
  on <tabela> for all
  using (is_allowed_user());
```

**Não usar** `auth.role() = 'authenticated'`: qualquer conta Google logada passaria a ter acesso total.
Adicionar/remover e-mails da allowlist é uma alteração de permissões em produção e exige autorização.

---

## Funções

- `is_allowed_user()`: verifica o e-mail do JWT contra `allowed_users`.
- `calculate_streamer_metrics(start_date)`: métricas dos snapshots (usada por `consolidate-daily`).
- `get_latest_snapshots(streamer_ids)` e `get_streamers_with_live_status()`: leituras otimizadas.

---

## Migrations

Para adicionar/alterar colunas, crie um arquivo em `supabase/migrations/` (os históricos já aplicados em produção ficam em `docs/migrations-aplicadas/`, fora de `supabase/migrations/` para a CLI não reaplicá-los). Em produção, só execute com autorização e rollback preparado:

```sql
-- migrations/2026_07_26_add_my_commission.sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS my_commission NUMERIC DEFAULT 0;
```

Execute no SQL Editor do Supabase.

---

## Limpeza Automática

Para habilitar limpeza de snapshots antigos (> 6 meses):

1. Habilite a extensão `pg_cron` no Supabase (Database → Extensions)
2. Execute:
```sql
select cron.schedule(
  'cleanup-old-snapshots',
  '0 3 1 * *',  -- dia 1 de cada mês às 3h
  $$delete from stream_snapshots where captured_at < now() - interval '6 months'$$
);
```
