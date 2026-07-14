import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// v13 - action "lookup" combina user + channel + last_video/streams numa única invocação

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

let token: string | null = null
let tokenExpiry = 0

async function getTwitchToken(clientId: string, clientSecret: string): Promise<string> {
  if (token && Date.now() < tokenExpiry) return token
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
  })
  const data = await res.json()
  token = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return token!
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    // Verificar auth (apenas usuários logados)
    const authHeader = req.headers.get("authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders })

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!)
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders })

    const clientId = Deno.env.get("TWITCH_CLIENT_ID")!
    const clientSecret = Deno.env.get("TWITCH_CLIENT_SECRET")!
    const accessToken = await getTwitchToken(clientId, clientSecret)

    const url = new URL(req.url)
    const action = url.searchParams.get("action")

    let result: unknown

    if (action === "users") {
      const logins = url.searchParams.get("logins")?.split(",").filter(Boolean) || []
      if (!logins.length) return new Response("[]", { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

      const params = logins.map(l => `login=${encodeURIComponent(l.toLowerCase())}`).join("&")
      const res = await fetch(`https://api.twitch.tv/helix/users?${params}`, {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
      })
      const data = await res.json()
      const users = data.data || []

      // Fetch channel info (broadcaster_language) in batch
      if (users.length) {
        const ids = users.map((u: { id: string }) => `broadcaster_id=${u.id}`).join("&")
        const chRes = await fetch(`https://api.twitch.tv/helix/channels?${ids}`, {
          headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
        })
        const chData = await chRes.json()
        const chMap = new Map<string, { broadcaster_language: string; game_name: string }>()
        for (const ch of (chData.data || [])) chMap.set(ch.broadcaster_id, ch)
        result = users.map((u: { id: string }) => ({ ...u, broadcaster_language: chMap.get(u.id)?.broadcaster_language || "", game_name: chMap.get(u.id)?.game_name || "" }))
      } else {
        result = []
      }

    } else if (action === "user") {
      const username = url.searchParams.get("username")
      if (!username) return new Response("Missing username", { status: 400, headers: corsHeaders })

      const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
      })
      const data = await res.json()
      const u = data.data?.[0]
      if (!u) return new Response(JSON.stringify(null), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

      const chRes = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${u.id}`, {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
      })
      const chData = await chRes.json()
      const channel = chData.data?.[0]
      result = { ...u, broadcaster_language: channel?.broadcaster_language || "", game_name: channel?.game_name || "" }

    } else if (action === "streams") {
      const usernames = url.searchParams.get("usernames")?.split(",") || []
      if (!usernames.length) return new Response("[]", { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })

      const params = usernames.map(u => `user_login=${encodeURIComponent(u.toLowerCase())}`).join("&")
      const res = await fetch(`https://api.twitch.tv/helix/streams?${params}&first=100`, {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
      })
      const data = await res.json()
      result = data.data || []

    } else if (action === "search_categories") {
      const query = url.searchParams.get("query")
      if (!query) return new Response("Missing query", { status: 400, headers: corsHeaders })

      const res = await fetch(`https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}&first=10`, {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
      })
      const data = await res.json()
      result = data.data || []

    } else if (action === "streams_by_game") {
      const gameId = url.searchParams.get("game_id") || ""
      const first = url.searchParams.get("first") || "100"
      const language = url.searchParams.get("language") || ""
      const langParam = language ? `&language=${language}` : ""
      const gameParam = gameId ? `&game_id=${gameId}` : ""

      const allStreams: Array<Record<string, unknown>> = []
      let cursor = ""

      // Buscar até 2 páginas
      for (let i = 0; i < 2; i++) {
        const afterParam = cursor ? `&after=${cursor}` : ""
        const res = await fetch(`https://api.twitch.tv/helix/streams?first=100${gameParam}${langParam}${afterParam}`, {
          headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
        })
        const data = await res.json()
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
          const usersRes = await fetch(`https://api.twitch.tv/helix/users?${ids}`, {
            headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
          })
          const usersData = await usersRes.json()
          for (const u of (usersData.data || [])) usersMap.set(u.id, u)
        }
        result = allStreams.map((s) => ({ ...s, user_info: usersMap.get(s.user_id as string) || null }))
      } else {
        result = []
      }

    } else if (action === "last_video") {
      const userId = url.searchParams.get("user_id")
      if (!userId) return new Response("Missing user_id", { status: 400, headers: corsHeaders })

      const res = await fetch(`https://api.twitch.tv/helix/videos?user_id=${userId}&first=1&type=archive`, {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
      })
      const data = await res.json()
      result = data.data?.[0] || null

    } else if (action === "lookup") {
      // Combina user + channel + last_video/streams numa única invocação (evita 3 round-trips serializados)
      const username = url.searchParams.get("username")
      if (!username) return new Response("Missing username", { status: 400, headers: corsHeaders })

      const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
        headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
      })
      const userData = await userRes.json()
      const u = userData.data?.[0]
      if (!u) {
        result = { user: null, lastLive: null }
      } else {
        const [chData, videoData, streamsData] = await Promise.all([
          fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${u.id}`, {
            headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
          }).then(r => r.json()),
          fetch(`https://api.twitch.tv/helix/videos?user_id=${u.id}&first=1&type=archive`, {
            headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
          }).then(r => r.json()),
          fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(u.login.toLowerCase())}&first=100`, {
            headers: { "Client-ID": clientId, "Authorization": `Bearer ${accessToken}` }
          }).then(r => r.json())
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
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
