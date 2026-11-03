// v14 - exige x-cron-secret, CORS restrito; so limpa snapshots se todos os updates deram certo e reporta falhas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { buildCorsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, "x-cron-secret")
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const cronSecret = Deno.env.get("CRON_SECRET")
  // Fail-closed: sem CRON_SECRET configurado, ou com header diferente, nada executa.
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const startDate = thirtyDaysAgo.toISOString()

    // Calcular métricas direto no Postgres (sem limit de 1000!)
    const { data: metrics, error: metricsError } = await supabase.rpc('calculate_streamer_metrics', {
      start_date: startDate
    })

    if (metricsError) {
      return new Response(JSON.stringify({ error: "Metrics calculation error", details: metricsError }), { status: 500, headers: corsHeaders })
    }

    if (!metrics?.length) {
      return new Response(JSON.stringify({ msg: "Nenhum streamer com dados nos últimos 30 dias", startDate }), { headers: corsHeaders })
    }

    // Executar updates em paralelo (batch de 10)
    const updateResults = []
    for (let i = 0; i < metrics.length; i += 10) {
      const batch = metrics.slice(i, i + 10)
      const results = await Promise.all(
        batch.map(async m => {
          const result = await supabase.from("streamers").update({
            avg_viewers: m.avg_viewers,
            peak_viewers: m.peak_viewers,
            hours_streamed: m.hours_streamed,
            hours_watched: m.hours_watched
          }).eq("id", m.streamer_id)
          return { id: m.streamer_id, success: !result.error, error: result.error?.message }
        })
      )
      updateResults.push(...results)
    }

    const failed = updateResults.filter(r => !r.success)
    if (failed.length) {
      // Nao apaga nada se a consolidacao falhou: os snapshots continuam disponiveis para a proxima rodada.
      return new Response(JSON.stringify({
        error: "Falha ao atualizar streamers",
        consolidated: metrics.length - failed.length,
        failed: failed.length,
        cleaned: false,
        failures: failed.slice(0, 5)
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // Limpar snapshots antigos (so dados fora da janela de 30 dias das metricas)
    const { error: cleanError } = await supabase.from("stream_snapshots").delete().lt("captured_at", startDate)
    if (cleanError) {
      return new Response(JSON.stringify({
        error: "Falha ao limpar snapshots antigos",
        consolidated: metrics.length,
        cleaned: false,
        details: cleanError.message
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    return new Response(JSON.stringify({
      consolidated: metrics.length,
      period: "last_30_days",
      cleaned: true,
      startDate
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
