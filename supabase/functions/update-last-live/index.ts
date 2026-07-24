import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// v2 - exige JWT valido do usuario logado (evita update de last_live_at por request nao autenticada)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders })

    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!)
    const { data: { user } } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""))
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders })

    const { streamer_id, last_live_at } = await req.json()
    if (!streamer_id || !last_live_at) {
      return new Response(JSON.stringify({ error: "streamer_id and last_live_at required" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { error } = await supabase
      .from("streamers")
      .update({ last_live_at })
      .eq("id", streamer_id)

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
