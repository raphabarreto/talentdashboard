// v11 - SOLUÇÃO DEFINITIVA: Usar SQL direto no Postgres (sem limit de 1000)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || 
                        Deno.env.get("SUPABASE_SECRET_KEYS") ||
                        Deno.env.get("SUPABASE_ANON_KEY")!
    
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
      return new Response(JSON.stringify({ error: "Metrics calculation error", details: metricsError }), { status: 500 })
    }

    if (!metrics?.length) {
      return new Response(JSON.stringify({ msg: "Nenhum streamer com dados nos últimos 30 dias", startDate }))
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

    // Limpar snapshots antigos
    await supabase.from("stream_snapshots").delete().lt("captured_at", startDate)

    return new Response(JSON.stringify({ 
      consolidated: metrics.length, 
      period: "last_30_days",
      cleaned: true,
      startDate,
      updateResults: updateResults.slice(0, 5)
    }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
