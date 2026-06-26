import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const twitchClientId = Deno.env.get("TWITCH_CLIENT_ID")!
    const twitchClientSecret = Deno.env.get("TWITCH_CLIENT_SECRET")!

    // Obter token
    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${twitchClientId}&client_secret=${twitchClientSecret}&grant_type=client_credentials`
    })
    const { access_token } = await tokenRes.json()

    // Consultar usuário
    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=gratis150ml`, {
      headers: { "Client-ID": twitchClientId, "Authorization": `Bearer ${access_token}` }
    })
    const userData = await userRes.json()

    // Consultar stream
    const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_login=gratis150ml`, {
      headers: { "Client-ID": twitchClientId, "Authorization": `Bearer ${access_token}` }
    })
    const streamData = await streamRes.json()

    return new Response(
      JSON.stringify({ user: userData, stream: streamData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
