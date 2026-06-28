// v4 - Otimizado para não dar timeout
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const startDate = thirtyDaysAgo.toISOString()

    // Buscar todos os snapshots dos últimos 30 dias de uma vez (mais rápido)
    const { data: allSnaps } = await supabase
      .from("stream_snapshots")
      .select("streamer_id, viewers, is_live")
      .gte("captured_at", startDate)

    if (!allSnaps?.length) {
      return new Response(JSON.stringify({ msg: "Sem snapshots nos últimos 30 dias" }))
    }

    // Agrupar por streamer_id
    const byStreamer = new Map<number, Array<{ viewers: number; is_live: boolean }>>()
    for (const snap of allSnaps) {
      if (!byStreamer.has(snap.streamer_id)) byStreamer.set(snap.streamer_id, [])
      byStreamer.get(snap.streamer_id)!.push({ viewers: snap.viewers, is_live: snap.is_live })
    }

    // Preparar updates em batch
    const updates = []
    for (const [streamerId, snaps] of byStreamer) {
      const liveSnaps = snaps.filter(s => s.is_live)
      
      const avgViewers = liveSnaps.length > 0
        ? Math.round(liveSnaps.reduce((sum, s) => sum + s.viewers, 0) / liveSnaps.length)
        : 0
      const peakViewers = liveSnaps.length > 0 ? Math.max(...liveSnaps.map(s => s.viewers)) : 0
      const hoursStreamed = Math.round((liveSnaps.length * 15) / 60)
      const hoursWatched = Math.round(liveSnaps.reduce((sum, s) => sum + s.viewers * 15, 0) / 60)

      updates.push({
        id: streamerId,
        avg_viewers: avgViewers,
        peak_viewers: peakViewers,
        hours_watched: hoursWatched,
        hours_streamed: hoursStreamed,
        is_active: hoursStreamed > 0,
      })
    }

    // Executar updates em paralelo (batch de 10)
    for (let i = 0; i < updates.length; i += 10) {
      const batch = updates.slice(i, i + 10)
      await Promise.all(
        batch.map(u => supabase.from("streamers").update(u).eq("id", u.id))
      )
    }

    // Limpar snapshots antigos
    await supabase.from("stream_snapshots").delete().lt("captured_at", startDate)

    return new Response(JSON.stringify({ 
      consolidated: updates.length, 
      period: "last_30_days",
      cleaned: true 
    }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
