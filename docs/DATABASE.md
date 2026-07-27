# Database Schema - Talent Dashboard

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
| `is_active` | boolean | Status (ativo se transmitiu nos últimos 30 dias) |
| `main_category` | text | Categoria principal do streamer (coluna legada, sem uso na UI atual) |
| `last_live_at` | timestamptz | Última vez que ficou online |
| `created_at` | timestamptz | Data de criação |

---

### `stream_snapshots`
Coleta periódica de viewers (a cada 5 minutos via Edge Function).

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

### `campaigns`
Campanhas comerciais com empresas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Primary key |
| `company` | text | Nome da empresa/marca |
| `start_date` | date | Data de início |
| `end_date` | date | Data de fim |
| `total_received` | numeric | Valor total recebido da empresa |
| `my_commission` | numeric | Comissão informada manualmente |
| `currency` | text | Moeda (`BRL` ou `USD`) |
| `commission_percentage` | numeric | Percentual de comissão (deprecated) |
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
| `payment` | numeric | Valor pago ao streamer (opcional) |
| `payment_date` | date | Data do pagamento ao streamer |
| `contact_status` | text | Status: `pendente`, `contatado`, `nao_respondeu`, `confirmado`, `recusado` |
| `email` | text | Email do streamer (opcional) |

**Auto-registro:** Quando um streamer é marcado como `confirmado`, ele é automaticamente adicionado à tabela `streamers` (se ainda não existir).

---

## Row Level Security (RLS)

Todas as tabelas têm RLS habilitado e permitem **todas as operações** para usuários autenticados:

```sql
create policy "Allow all for authenticated users"
  on <tabela> for all
  using (auth.role() = 'authenticated');
```

---

## Migrations

Para adicionar/alterar colunas, crie um arquivo em `migrations/`:

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
