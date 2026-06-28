# Mudança: Métricas dos Últimos 30 Dias Rolantes

**Data:** 27/06/2026

## Problema Original

Streamers novos apareciam com 0 nas métricas (média de viewers, pico, horas) porque a consolidação calculava apenas o **mês anterior** (ex: maio) e só rodava 1x por mês.

## Solução Implementada

Mudança na `consolidate-monthly` para calcular **últimos 30 dias rolantes**:

### Alterações no código:

1. **Período de cálculo:**
   - Antes: mês anterior (ex: 2026-05)
   - Depois: últimos 30 dias a partir de hoje

2. **Cálculo de horas:**
   - Antes: `liveSnaps.length * 240 / 60` (assumia 4h por snap ❌)
   - Depois: `liveSnaps.length * 15 / 60` (15min por snap ✅)

3. **Histórico mensal:**
   - Removido: `streamer_history` não é mais atualizado (não faz sentido com 30 dias rolantes)

4. **Deleção de snapshots:**
   - Antes: deletava snapshots do mês consolidado
   - Depois: deleta apenas snapshots com **mais de 30 dias**

5. **Frequência do cron:**
   - Antes: 1x por mês (dia 1º às 3h) → `0 3 1 * *`
   - Depois: 1x por dia (todo dia às 3h) → `0 3 * * *`

### Arquivo modificado:
- `supabase/functions/consolidate-monthly/index.ts`

### Deploy:
```bash
npx supabase functions deploy consolidate-monthly --no-verify-jwt
```

Versão deployada: **v3** (2026-06-27 04:45:55 UTC)

## Resultado

✅ **Funcionou!** 
- Streamers antigos (darkmoonknit, Narkesh) mostram métricas corretas dos últimos 30 dias
- Streamers novos (Arkane) começam com 0 e vão acumulando dados conforme passam os dias
- Métricas sempre atualizadas (não resetam no início do mês)
- Compatível com Sully Gnome (também usa 30 dias rolantes)

## Comportamento Esperado

- **Streamer novo (adicionado hoje):** 0 nas métricas, vai crescendo dia a dia
- **Streamer com 7 dias:** métricas baseadas em 7 dias
- **Streamer com 30+ dias:** métricas estáveis dos últimos 30 dias
- **Streamer offline:** não adiciona dados, mas não zera as métricas

## Backup do Código Original

<details>
<summary>Clique para ver código original (antes da mudança)</summary>

```typescript
// Mês anterior (ex: 2026-05)
const now = new Date()
now.setMonth(now.getMonth() - 1)
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
const startDate = `${month}-01T00:00:00Z`
const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

// ... (processamento) ...

const hoursStreamed = Math.round((liveSnaps.length * 240) / 60) // 240min = 4h ❌
const hoursWatched = Math.round(liveSnaps.reduce((sum, sn) => sum + sn.viewers * 240, 0) / 60)

// Upsert no histórico
await supabase.from("streamer_history").upsert({
  streamer_id: s.id,
  month,
  avg_viewers: avgViewers,
  peak_viewers: peakViewers,
  hours_watched: hoursWatched,
  hours_streamed: hoursStreamed,
}, { onConflict: "streamer_id,month" })

// Limpar snapshots do mês consolidado
await supabase.from("stream_snapshots").delete().lt("captured_at", endDate)
```

</details>

## Rollback (se precisar)

Se algo der errado, reverter para o código original acima e fazer deploy novamente.
