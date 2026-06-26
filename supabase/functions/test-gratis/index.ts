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

    // Teste 1: consulta individual
    const test1 = await fetch(`https://api.twitch.tv/helix/streams?user_login=gratis150ml`, {
      headers: { "Client-ID": twitchClientId, "Authorization": `Bearer ${access_token}` }
    })
    const result1 = await test1.json()

    // Teste 2: consulta em batch com tck10
    const test2 = await fetch(`https://api.twitch.tv/helix/streams?user_login=gratis150ml&user_login=tck10`, {
      headers: { "Client-ID": twitchClientId, "Authorization": `Bearer ${access_token}` }
    })
    const result2 = await test2.json()

    return new Response(
      JSON.stringify({ individual: result1, batch: result2 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
