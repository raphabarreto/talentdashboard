import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0"
import { buildCorsHeaders } from "../_shared/cors.ts"
import { updateLastLiveSchema } from "../_shared/validators.ts"
// v4 - exige JWT valido, CORS restrito, valida input com Zod e grava via RLS (sem service role)

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders })

    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!)
    const { data: { user } } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""))
    if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders })

    const body = await req.json().catch(() => null)
    const parsed = updateLastLiveSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }
    const { streamer_id, last_live_at } = parsed.data

    // Grava com o JWT do proprio usuario (nao a service role), para que a RLS por
    // allowlist de email decida quem pode alterar. Com service role, qualquer conta
    // Google autenticada conseguiria contornar a allowlist.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: updated, error } = await supabase
      .from("streamers")
      .update({ last_live_at })
      .eq("id", streamer_id)
      .select("id")

    if (error) throw error

    // Nenhuma linha afetada: a RLS bloqueou (usuario fora da allowlist) ou o streamer nao existe.
    if (!updated?.length) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

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
