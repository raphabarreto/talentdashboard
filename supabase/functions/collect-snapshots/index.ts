import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0"
import { buildCorsHeaders } from "../_shared/cors.ts"
// v4 - exige x-cron-secret, CORS restrito; aborta sem gravar se a Twitch falhar (evita snapshots "offline" falsos)

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
    const twitchClientId = Deno.env.get("TWITCH_CLIENT_ID")!
    const twitchClientSecret = Deno.env.get("TWITCH_CLIENT_SECRET")!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Buscar todos os streamers
    const { data: streamers, error } = await supabase.from("streamers").select("id, name")
    if (error || !streamers?.length) {
      return new Response(JSON.stringify({ msg: "Nenhum streamer encontrado", error }), { status: 200, headers: corsHeaders })
    }

    // 2. Obter token da Twitch
    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${twitchClientId}&client_secret=${twitchClientSecret}&grant_type=client_credentials`
    })
    if (!tokenRes.ok) throw new Error(`Falha ao obter token da Twitch (HTTP ${tokenRes.status})`)
    const { access_token } = await tokenRes.json()
    if (!access_token) throw new Error("Token da Twitch ausente na resposta")

    // 3. Consultar streams ao vivo (batches de 10 - limite conservador da Twitch)
    const liveMap = new Map<string, { viewers: number; game: string }>()

    for (let i = 0; i < streamers.length; i += 10) {
      const batch = streamers.slice(i, i + 10)
      const params = batch.map(s => `user_login=${encodeURIComponent(s.name.toLowerCase())}`).join("&")
      const res = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
        headers: { "Client-ID": twitchClientId, "Authorization": `Bearer ${access_token}` }
      })
      // Resposta de erro nao pode virar "ninguem ao vivo": aborta e nada e gravado.
      if (!res.ok) throw new Error(`Falha ao consultar streams da Twitch (HTTP ${res.status})`)
      const { data: streams } = await res.json()

      for (const s of streams || []) {
        liveMap.set(s.user_login.toLowerCase(), { viewers: s.viewer_count, game: s.game_name })
      }
    }

    // 4. Gravar snapshots
    const snapshots = streamers.map(s => {
      const live = liveMap.get(s.name.toLowerCase())
      return {
        streamer_id: s.id,
        viewers: live?.viewers || 0,
        is_live: !!live,
        game: live?.game || "",
      }
    })

    const { error: insertError } = await supabase.from("stream_snapshots").insert(snapshots)
    if (insertError) throw new Error(`Falha ao gravar snapshots: ${insertError.message}`)

    // 5. Atualizar last_live_at dos que estão ao vivo
    const liveIds = streamers.filter(s => liveMap.has(s.name.toLowerCase())).map(s => s.id)
    if (liveIds.length) {
      const { error: updateError } = await supabase.from("streamers").update({ last_live_at: new Date().toISOString() }).in("id", liveIds)
      if (updateError) throw new Error(`Falha ao atualizar last_live_at: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({ collected: snapshots.length, live: liveMap.size }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
