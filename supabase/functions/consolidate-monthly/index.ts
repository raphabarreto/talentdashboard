import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Mês anterior (ex: 2026-05)
    const now = new Date()
    now.setMonth(now.getMonth() - 1)
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const startDate = `${month}-01T00:00:00Z`
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

    // Buscar streamers
    const { data: streamers } = await supabase.from("streamers").select("id, name")
    if (!streamers?.length) return new Response(JSON.stringify({ msg: "Sem streamers" }))

    let consolidated = 0

    for (const s of streamers) {
      // Buscar snapshots do mês anterior
      const { data: snaps } = await supabase
        .from("stream_snapshots")
        .select("viewers, is_live")
        .eq("streamer_id", s.id)
        .gte("captured_at", startDate)
        .lt("captured_at", endDate)

      if (!snaps?.length) continue

      const liveSnaps = snaps.filter(sn => sn.is_live)
      const avgViewers = liveSnaps.length > 0
        ? Math.round(liveSnaps.reduce((sum, sn) => sum + sn.viewers, 0) / liveSnaps.length)
        : 0
      const peakViewers = liveSnaps.length > 0
        ? Math.max(...liveSnaps.map(sn => sn.viewers))
        : 0
      const hoursStreamed = Math.round((liveSnaps.length * 5) / 60) // cada snap = 5min
      const hoursWatched = Math.round(liveSnaps.reduce((sum, sn) => sum + sn.viewers * 5, 0) / 60)

      // Upsert no histórico
      await supabase.from("streamer_history").upsert({
        streamer_id: s.id,
        month,
        avg_viewers: avgViewers,
        peak_viewers: peakViewers,
        hours_watched: hoursWatched,
        hours_streamed: hoursStreamed,
      }, { onConflict: "streamer_id,month" })

      // Atualizar métricas atuais do streamer
      await supabase.from("streamers").update({
        avg_viewers: avgViewers,
        peak_viewers: peakViewers,
        hours_watched: hoursWatched,
        hours_streamed: hoursStreamed,
        is_active: hoursStreamed > 0,
      }).eq("id", s.id)

      consolidated++
    }

    // Limpar snapshots > 6 meses
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    await supabase
      .from("stream_snapshots")
      .delete()
      .lt("captured_at", sixMonthsAgo.toISOString())

    return new Response(JSON.stringify({ consolidated, month, cleaned: true }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
