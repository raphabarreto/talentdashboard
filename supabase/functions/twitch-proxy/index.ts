import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0"
import { buildCorsHeaders } from "../_shared/cors.ts"
import { twitchProxyParamsSchema } from "../_shared/validators.ts"
// v16 - allowlist (is_allowed_user), encode dos parametros, CORS restrito, Zod; falhas da Twitch viram 502

let token: string | null = null
let tokenExpiry = 0

class TwitchApiError extends Error {
  constructor(public status: number) { super(`Twitch API HTTP ${status}`) }
}

async function getTwitchToken(clientId: string, clientSecret: string): Promise<string> {
  if (token && Date.now() < tokenExpiry) return token
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
  })
  if (!res.ok) throw new TwitchApiError(res.status)
  const data = await res.json()
  if (!data.access_token) throw new TwitchApiError(502)
  token = data.access_token
  tokenExpiry = Date.now() + ((Number(data.expires_in) || 0) - 60) * 1000
  return token!
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // Verificar auth (apenas usuários logados)
    const authHeader = req.headers.get("authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders })

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!)
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders })

    // Allowlist: qualquer conta Google autenticada tem JWT valido, entao checa
    // is_allowed_user() com o JWT do proprio usuario antes de gastar cota da Twitch.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: allowed, error: allowError } = await userClient.rpc("is_allowed_user")
    if (allowError) throw allowError
    if (allowed !== true) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const clientId = Deno.env.get("TWITCH_CLIENT_ID")!
    const clientSecret = Deno.env.get("TWITCH_CLIENT_SECRET")!
    const accessToken = await getTwitchToken(clientId, clientSecret)

    // Toda chamada a Twitch passa por aqui: resposta de erro vira excecao (502), nunca "lista vazia".
    const helix = async (url: string) => {
      const r = await fetch(url, { headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` } })
      if (!r.ok) throw new TwitchApiError(r.status)
      return await r.json()
    }

    const url = new URL(req.url)
    const rawParams = Object.fromEntries(url.searchParams.entries())
    const parsedParams = twitchProxyParamsSchema.safeParse(rawParams)
    if (!parsedParams.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsedParams.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    const { action, username, query, game_id: gameIdParam, first: firstParam, language: languageParam, user_id: userIdParam } = parsedParams.data

    let result: unknown

    if (action === "users") {
      const logins = parsedParams.data.logins?.split(",").filter(Boolean) || []
      if (!logins.length) return new Response("[]", { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

      const params = logins.map(l => `login=${encodeURIComponent(l.toLowerCase())}`).join("&")
      const data = await helix(`https://api.twitch.tv/helix/users?${params}`)
      const users = data.data || []

      // Fetch channel info (broadcaster_language) in batch
      if (users.length) {
        const ids = users.map((u: { id: string }) => `broadcaster_id=${u.id}`).join("&")
        const chData = await helix(`https://api.twitch.tv/helix/channels?${ids}`)
        const chMap = new Map<string, { broadcaster_language: string; game_name: string }>()
        for (const ch of (chData.data || [])) chMap.set(ch.broadcaster_id, ch)
        result = users.map((u: { id: string }) => ({ ...u, broadcaster_language: chMap.get(u.id)?.broadcaster_language || "", game_name: chMap.get(u.id)?.game_name || "" }))
      } else {
        result = []
      }

    } else if (action === "user") {
      const data = await helix(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username!)}`)
      const u = data.data?.[0]
      if (!u) return new Response(JSON.stringify(null), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

      const chData = await helix(`https://api.twitch.tv/helix/channels?broadcaster_id=${u.id}`)
      const channel = chData.data?.[0]
      result = { ...u, broadcaster_language: channel?.broadcaster_language || "", game_name: channel?.game_name || "" }

    } else if (action === "streams") {
      const usernames = parsedParams.data.usernames?.split(",") || []
      if (!usernames.length) return new Response("[]", { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

      const params = usernames.map(u => `user_login=${encodeURIComponent(u.toLowerCase())}`).join("&")
      const data = await helix(`https://api.twitch.tv/helix/streams?${params}&first=100`)
      result = data.data || []

    } else if (action === "search_categories") {
      const data = await helix(`https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query!)}&first=10`)
      result = data.data || []

    } else if (action === "streams_by_game") {
      const gameId = gameIdParam || ""
      const first = firstParam || "100"
      const language = languageParam || ""
      const langParam = language ? `&language=${encodeURIComponent(language)}` : ""
      const gameParam = gameId ? `&game_id=${encodeURIComponent(gameId)}` : ""

      const allStreams: Array<Record<string, unknown>> = []
      let cursor = ""

      // Buscar até 2 páginas
      for (let i = 0; i < 2; i++) {
        const afterParam = cursor ? `&after=${encodeURIComponent(cursor)}` : ""
        const data = await helix(`https://api.twitch.tv/helix/streams?first=100${gameParam}${langParam}${afterParam}`)
        const streams = data.data || []
        if (!streams.length) break
        allStreams.push(...streams)
        cursor = data.pagination?.cursor || ""
        if (!cursor || allStreams.length >= parseInt(first)) break
      }

      // Buscar info dos users (description) em batch
      if (allStreams.length) {
        const usersMap = new Map<string, unknown>()
        for (let i = 0; i < allStreams.length; i += 100) {
          const batch = allStreams.slice(i, i + 100)
          const ids = batch.map((s) => `id=${s.user_id}`).join("&")
          const usersData = await helix(`https://api.twitch.tv/helix/users?${ids}`)
          for (const u of (usersData.data || [])) usersMap.set(u.id, u)
        }
        result = allStreams.map((s) => ({ ...s, user_info: usersMap.get(s.user_id as string) || null }))
      } else {
        result = []
      }

    } else if (action === "last_video") {
      const data = await helix(`https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(userIdParam!)}&first=1&type=archive`)
      result = data.data?.[0] || null

    } else if (action === "lookup") {
      // Combina user + channel + last_video/streams numa única invocação (evita 3 round-trips serializados)
      const userData = await helix(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username!)}`)
      const u = userData.data?.[0]
      if (!u) {
        result = { user: null, lastLive: null }
      } else {
        const [chData, videoData, streamsData] = await Promise.all([
          helix(`https://api.twitch.tv/helix/channels?broadcaster_id=${u.id}`),
          helix(`https://api.twitch.tv/helix/videos?user_id=${u.id}&first=1&type=archive`),
          helix(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(u.login.toLowerCase())}&first=100`)
        ])

        const channel = chData.data?.[0]
        const user = { ...u, broadcaster_language: channel?.broadcaster_language || "", game_name: channel?.game_name || "" }

        const lastVideo = videoData.data?.[0]
        let lastLive: string | null = null
        if (lastVideo?.created_at) {
          lastLive = lastVideo.created_at
        } else if (Array.isArray(streamsData.data) && streamsData.data.length > 0) {
          lastLive = new Date().toISOString()
        }

        result = { user, lastLive }
      }

    } else {
      return new Response("Invalid action", { status: 400, headers: corsHeaders })
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err) {
    if (err instanceof TwitchApiError) {
      // Token invalido/expirado (401) ou limite da Twitch (429) tambem chegam aqui.
      if (err.status === 401) token = null
      return new Response(JSON.stringify({ error: "Twitch indisponivel", twitch_status: err.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
